import type { AdoptLateCleanup, DisposalMode } from "../contracts.js";
import { ContainerDisposedError } from "../errors.js";
import {
	continueWithoutWaiting,
	invokeAsyncDispose,
	invokeSyncDispose,
	requireSynchronousDispose,
} from "../services/async-dispose.js";
import { observePromiseRejection } from "../services/promise-value.js";

/** Lifetimes that keep one service value per lifecycle instance. */
export type CachingLifetime = "singleton" | "scoped";

interface ClosedState {
	readonly mode: DisposalMode;
	readonly adopt: AdoptLateCleanup;
}

/**
 * Used when a lifecycle is disposed without a container, for example in a
 * unit test. The cleanup still runs, but no caller waits for it.
 */
const ignoreLateCleanup: AdoptLateCleanup = (cleanup) => {
	continueWithoutWaiting(cleanup);
};

/**
 * Creates one service value on the first request and keeps it until disposal.
 *
 * Singleton and scoped lifecycles share this behavior. They differ only in
 * how they create scopes. A rejected factory Promise clears the cached value,
 * so the next request calls the factory again.
 *
 * @internal
 */
export class CachedInstance {
	private readonly _lifetime: CachingLifetime;
	private _instance: any;
	private _initialized = false;
	private _factory: ((...args: any[]) => any) | null = null;
	private _isDisposed = false;
	/** Set when the owning container starts its disposal. */
	private _closed: ClosedState | null = null;

	constructor(lifetime: CachingLifetime) {
		this._lifetime = lifetime;
	}

	/**
	 * Stops new resolutions. The owning container calls this method before it
	 * starts any cleanup, so a factory that disposes its own container cannot
	 * hand out a value.
	 */
	public close(mode: DisposalMode, adopt: AdoptLateCleanup): void {
		this._closed ??= { mode, adopt };
	}

	public get isDisposed(): boolean {
		return this._isDisposed;
	}

	public setFactory(factory: (...args: any[]) => any): void {
		if (this._isDisposed) {
			throw new Error(
				`Cannot set factory on a disposed ${this._lifetime} lifecycle`,
			);
		}
		if (!factory || typeof factory !== "function") {
			throw new Error("Factory must be a valid function");
		}
		this._factory = factory;
	}

	/**
	 * Returns the factory for the lifecycle of a new scope.
	 * @throws {Error} If this lifecycle is disposed or has no factory
	 */
	public factoryForNewScope(): (...args: any[]) => any {
		if (this._isDisposed) {
			throw new Error("Cannot create new scope from disposed lifecycle");
		}
		if (!this._factory) {
			throw new Error("No factory available to create new scope");
		}
		return this._factory;
	}

	/**
	 * Returns the cached value, or creates it with the factory arguments on the
	 * first request. The caller passes the arguments as one array, so a cache
	 * hit does not copy them again.
	 */
	public getInstance<T>(args: readonly unknown[]): T {
		if (this._closed) {
			throw new ContainerDisposedError(this.disposedMessage());
		}
		if (!this._factory) {
			throw new Error("No factory registered for this lifecycle");
		}

		if (!this._initialized) {
			// A factory error propagates unchanged. The container wraps it once.
			const factoryValue = this._factory(...args);
			if (this._closed) {
				// The factory disposed its own container. Nothing owns the new value.
				throw this.discardValueCreatedAfterClose(factoryValue, this._closed);
			}
			const instance = observePromiseRejection(factoryValue, () => {
				if (!this._closed && this._instance === instance) {
					this._instance = undefined;
					this._initialized = false;
				}
			});
			this._instance = instance;
			this._initialized = true;
		}

		return this._instance as T;
	}

	/**
	 * Invokes the synchronous cleanup hook of a created value. The lifecycle
	 * stays disposed when the hook throws.
	 */
	public dispose(): void {
		if (this._isDisposed) {
			return;
		}
		this._isDisposed = true;
		this.close("sync", ignoreLateCleanup);

		try {
			if (this._initialized) {
				const result = invokeSyncDispose(this._instance);
				requireSynchronousDispose(result);
			}
		} finally {
			this.clear();
		}
	}

	/**
	 * Awaits the cleanup hook of a created value. For a Promise value, it waits
	 * for the value and invokes that value's cleanup hook.
	 */
	public async disposeAsync(): Promise<void> {
		if (this._isDisposed) {
			return;
		}
		this._isDisposed = true;
		this.close("async", ignoreLateCleanup);

		try {
			if (this._initialized) {
				await invokeAsyncDispose(this._instance);
			}
		} finally {
			this.clear();
		}
	}

	/**
	 * Cleans up a value that the factory returned after the lifecycle closed,
	 * and returns the error for the resolution. The cleanup follows the
	 * disposal path that closed the lifecycle: `dispose()` uses the synchronous
	 * hook, and a failure becomes the cause; `disposeAsync()` hands the
	 * asynchronous cleanup to the container, which waits for it.
	 */
	private discardValueCreatedAfterClose(
		value: unknown,
		closed: ClosedState,
	): ContainerDisposedError {
		if (closed.mode === "async") {
			closed.adopt(invokeAsyncDispose(value));
			return new ContainerDisposedError(this.disposedMessage());
		}

		try {
			requireSynchronousDispose(invokeSyncDispose(value));
		} catch (error) {
			return new ContainerDisposedError(this.disposedMessage(), {
				cause: error,
			});
		}
		return new ContainerDisposedError(this.disposedMessage());
	}

	private disposedMessage(): string {
		return `Cannot resolve from a disposed ${this._lifetime} lifecycle`;
	}

	private clear(): void {
		this._instance = undefined;
		this._initialized = false;
		this._factory = null;
	}
}

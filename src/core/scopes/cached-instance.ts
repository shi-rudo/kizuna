import type { DisposalMode } from "../contracts.js";
import { ContainerDisposedError } from "../errors.js";
import {
	invokeAsyncDispose,
	invokeSyncDispose,
	isPromiseLike,
	requireSynchronousDispose,
} from "../services/async-dispose.js";
import { observePromiseRejection } from "../services/promise-value.js";

/** Lifetimes that keep one service value per lifecycle instance. */
export type CachingLifetime = "singleton" | "scoped";

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
	/** Set once the owning container starts its disposal. */
	private _closedBy: DisposalMode | null = null;
	/**
	 * Number of factory calls that have not returned yet, so disposal can wait
	 * for their values. A factory can reach its own lifecycle again through
	 * another container, so the calls can nest.
	 */
	private _pendingCreations = 0;
	/**
	 * Asynchronous cleanup of a value that the factory returned after the
	 * close. `disposeAsync()` waits for it before dependencies are disposed.
	 */
	private _lateCleanup: Promise<void> | undefined;

	constructor(lifetime: CachingLifetime) {
		this._lifetime = lifetime;
	}

	/**
	 * Stops new resolutions. The owning container calls this method before it
	 * starts any cleanup, so a factory that disposes its own container cannot
	 * hand out a value.
	 */
	public close(mode: DisposalMode): void {
		this._closedBy ??= mode;
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
		if (this._closedBy) {
			throw new ContainerDisposedError(this.disposedMessage());
		}
		if (!this._factory) {
			throw new Error("No factory registered for this lifecycle");
		}

		if (!this._initialized) {
			// A factory error propagates unchanged. The container wraps it once.
			let factoryValue: unknown;
			this._pendingCreations++;
			try {
				factoryValue = this._factory(...args);
			} finally {
				this._pendingCreations--;
			}
			if (this._closedBy) {
				// The factory disposed its own container. Nothing owns the new value.
				throw this.discardValueCreatedAfterClose(factoryValue, this._closedBy);
			}
			const instance = observePromiseRejection(factoryValue, () => {
				// Until its own cleanup starts, a rejected value leaves the cache.
				if (!this._isDisposed && this._instance === instance) {
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
		this.close("sync");

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
	 * for the value and invokes that value's cleanup hook. If the factory of
	 * this lifecycle is still running, it first lets the factory return and
	 * then waits for the cleanup of that late value.
	 */
	public async disposeAsync(): Promise<void> {
		if (this._isDisposed) {
			return;
		}
		this._isDisposed = true;
		this.close("async");

		try {
			if (this._initialized) {
				await invokeAsyncDispose(this._instance);
			} else if (this._pendingCreations > 0) {
				// The factory runs synchronously, so it has returned after one turn.
				await Promise.resolve();
			}
			if (this._lateCleanup) {
				await this._lateCleanup;
			}
		} finally {
			this.clear();
		}
	}

	/**
	 * Cleans up a value that the factory returned after the lifecycle closed,
	 * and returns the error for the resolution.
	 *
	 * After `dispose()`, the value runs its synchronous cleanup, and a failure
	 * becomes the cause. After `disposeAsync()`, the value runs its asynchronous
	 * cleanup, and `disposeAsync()` of this lifecycle waits for it before its
	 * dependencies are disposed. A Promise value is the exception: an `async`
	 * factory can wait for `disposeAsync()` itself, so its cleanup starts
	 * without a waiter and a later failure is not reported.
	 */
	private discardValueCreatedAfterClose(
		value: unknown,
		closedBy: DisposalMode,
	): ContainerDisposedError {
		if (closedBy === "async") {
			const isPromiseValue = isPromiseLike(value);
			const cleanup = invokeAsyncDispose(value);
			// Mark a rejection as handled now; disposeAsync() still awaits it.
			void cleanup.catch(() => undefined);
			if (!isPromiseValue) {
				this._lateCleanup = cleanup;
			}
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
		this._lateCleanup = undefined;
	}
}

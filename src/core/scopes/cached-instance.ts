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

	constructor(lifetime: CachingLifetime) {
		this._lifetime = lifetime;
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
		if (this._isDisposed) {
			throw new ContainerDisposedError(
				`Cannot resolve from a disposed ${this._lifetime} lifecycle`,
			);
		}
		if (!this._factory) {
			throw new Error("No factory registered for this lifecycle");
		}

		if (!this._initialized) {
			// A factory error propagates unchanged. The container wraps it once.
			const factoryValue = this._factory(...args);
			if (this._isDisposed) {
				// The factory disposed its own container. Nothing owns the new value.
				throw this.discardValueCreatedAfterDisposal(factoryValue);
			}
			const instance = observePromiseRejection(factoryValue, () => {
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

		try {
			if (this._initialized) {
				await invokeAsyncDispose(this._instance);
			}
		} finally {
			this.clear();
		}
	}

	/**
	 * Cleans up a value that the factory returned after the lifecycle was
	 * disposed, and returns the error for the resolution. A failing cleanup
	 * becomes the cause. The cleanup of a Promise value starts here, but no
	 * caller can observe its later failure.
	 */
	private discardValueCreatedAfterDisposal(
		value: unknown,
	): ContainerDisposedError {
		const message = `Cannot resolve from a disposed ${this._lifetime} lifecycle`;
		try {
			continueWithoutWaiting(invokeSyncDispose(value));
		} catch (error) {
			return new ContainerDisposedError(message, { cause: error });
		}
		return new ContainerDisposedError(message);
	}

	private clear(): void {
		this._instance = undefined;
		this._initialized = false;
		this._factory = null;
	}
}

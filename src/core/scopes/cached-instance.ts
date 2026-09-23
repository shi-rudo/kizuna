import { CircularDependencyError } from "../errors.js";
import {
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

	/** The configured factory, or null before configuration and after disposal. */
	public get factory(): ((...args: any[]) => any) | null {
		return this._factory;
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

	public getInstance<T>(...args: any[]): T {
		if (this._isDisposed) {
			throw new Error(
				`Cannot resolve from a disposed ${this._lifetime} lifecycle`,
			);
		}
		if (!this._factory) {
			throw new Error("No factory registered for this lifecycle");
		}

		if (!this._initialized) {
			try {
				const factoryValue = this._factory(...args);
				let instance: any;
				instance = observePromiseRejection(factoryValue, () => {
					if (!this._isDisposed && this._instance === instance) {
						this._instance = undefined;
						this._initialized = false;
					}
				});
				this._instance = instance;
				this._initialized = true;
			} catch (error) {
				if (error instanceof CircularDependencyError) {
					throw error;
				}
				throw new Error(
					`Failed to resolve instance: ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				);
			}
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

	private clear(): void {
		this._instance = undefined;
		this._initialized = false;
		this._factory = null;
	}
}

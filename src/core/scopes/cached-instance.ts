import type { DisposalMode, FactoryArguments } from "../contracts.js";
import type { ContainerDisposedError } from "../errors.js";
import {
	invokeAsyncDispose,
	invokeSyncDispose,
	isPromiseLike,
	requireSynchronousDispose,
} from "../services/async-dispose.js";
import { observePromiseRejection } from "../services/promise-value.js";
import { LifecycleFactory, type ValueFactory } from "./lifecycle-factory.js";

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
	private readonly _factory: LifecycleFactory;
	private _instance: any;
	private _initialized = false;
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
		this._factory = new LifecycleFactory(lifetime);
	}

	/**
	 * Stops new resolutions. The owning container calls this method before it
	 * starts any cleanup, so a factory that disposes its own container cannot
	 * hand out a value.
	 */
	public close(mode: DisposalMode): void {
		this._factory.close(mode);
	}

	public get isDisposed(): boolean {
		return this._factory.isDisposed;
	}

	public setFactory(factory: ValueFactory): void {
		this._factory.set(factory);
	}

	/**
	 * Returns the factory for the lifecycle of a new scope.
	 * @throws {Error} If this lifecycle is disposed or has no factory
	 */
	public factoryForNewScope(): ValueFactory {
		return this._factory.forNewScope();
	}

	/**
	 * Returns the cached value, or creates it on the first request. It resolves
	 * the factory arguments only when it creates the value.
	 */
	public getInstance<T>(resolveArguments: FactoryArguments): T {
		this._factory.assertOpen();
		if (!this._initialized) {
			const args = resolveArguments();
			// Resolving the arguments can close this lifecycle, or create its value
			// through another container.
			const factory = this._factory.require();
			if (!this._initialized) {
				this.create(factory, args);
			}
		}

		return this._instance as T;
	}

	private create(factory: ValueFactory, args: readonly unknown[]): void {
		// A factory error propagates unchanged. The container wraps it once.
		let factoryValue: unknown;
		this._pendingCreations++;
		try {
			factoryValue = factory(...args);
		} finally {
			this._pendingCreations--;
		}
		const closedBy = this._factory.closedBy;
		if (closedBy) {
			// The factory disposed its own container. Nothing owns the new value.
			throw this.discardValueCreatedAfterClose(factoryValue, closedBy);
		}
		const instance = observePromiseRejection(factoryValue, () => {
			// Until its own cleanup starts, a rejected value leaves the cache.
			if (!this._factory.isDisposed && this._instance === instance) {
				this._instance = undefined;
				this._initialized = false;
			}
		});
		this._instance = instance;
		this._initialized = true;
	}

	/**
	 * Invokes the synchronous cleanup hook of a created value. The lifecycle
	 * stays disposed when the hook throws.
	 */
	public dispose(): void {
		if (this._factory.isDisposed) {
			return;
		}
		this._factory.dispose("sync");

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
		if (this._factory.isDisposed) {
			return;
		}
		this._factory.dispose("async");

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
	 * factory that calls `disposeAsync()` before its first `await` can then
	 * wait for it, so its cleanup starts without a waiter and a later failure is
	 * not reported.
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
			return this._factory.disposedError();
		}

		try {
			requireSynchronousDispose(invokeSyncDispose(value));
		} catch (error) {
			return this._factory.disposedError({ cause: error });
		}
		return this._factory.disposedError();
	}

	private clear(): void {
		this._instance = undefined;
		this._initialized = false;
		this._lateCleanup = undefined;
	}
}

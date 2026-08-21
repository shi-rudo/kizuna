import type { ConfigurableServiceLifecycle } from '../contracts.js';
import { CircularDependencyError } from '../errors.js';
import {
    invokeAsyncDispose,
    invokeSyncDispose,
    requireSynchronousDispose,
} from '../services/async-dispose.js';
import { observePromiseRejection } from '../services/promise-value.js';

/**
 * Singleton lifecycle implementation that maintains one instance for the entire application lifetime.
 *
 * This lifecycle strategy creates a single instance on the first request and reuses that same
 * instance for all subsequent requests throughout the application's lifetime. The instance is
 * shared across all scopes and is never disposed until the application terminates.
 *
 * **Characteristics:**
 * - **Instance Creation**: Lazy (created on first access)
 * - **Instance Sharing**: Shared across all scopes and contexts
 * - **Memory Usage**: Low (only one instance exists)
 * - **Thread Safety**: Implementation is not thread-safe (JavaScript is single-threaded)
 * - **Disposal**: Instance is never disposed during normal operation
 *
 * **Use Cases:**
 * - Expensive-to-create services (database connections, configuration)
 * - Shared state management (caches, registries)
 * - Application-wide services (logging, monitoring)
 * - Services that coordinate across the entire application
 *
 * @example
 * ```typescript
 * // Register a singleton service
 * builder.registerSingleton('DatabaseService', DatabaseService);
 *
 * // All requests return the same instance
 * const db1 = container.get('DatabaseService');
 * const db2 = container.get('DatabaseService');
 * console.log(db1 === db2); // true
 *
 * // Same instance across different scopes
 * const scope1 = container.startScope();
 * const scope2 = container.startScope();
 * const db3 = scope1.get('DatabaseService');
 * const db4 = scope2.get('DatabaseService');
 * console.log(db1 === db3 && db3 === db4); // true
 * ```
 *
 * @implements {ServiceLifecycle}
 */
export class SingletonLifecycle implements ConfigurableServiceLifecycle {
    public readonly lifetime = 'singleton' as const;
    public readonly valueOwnership = 'owned' as const;
    /**
     * The singleton instance.
     * @private
     */
    private _instance: any;

    /**
     * Whether the instance has been created.
     * @private
     */
    private _initialized = false;

    /**
     * The factory function used to create the singleton instance.
     * @private
     */
    private _factory: ((...args: any[]) => any) | null = null;

    /**
     * Whether this lifecycle has been disposed.
     * @private
     */
    private _isDisposed = false;

    /**
     * Sets the factory function that will be used to create the singleton instance.
     *
     * This method must be called before getInstance() to provide the creation logic.
     * The factory will only be called once, on the first request for the instance.
     *
     * @param {Function} factory - The factory function that creates the service instance
     * @throws {Error} If factory is not a valid function
     * @throws {Error} If the lifecycle has been disposed
     *
     * @example
     * ```typescript
     * const lifecycle = new SingletonLifecycle();
     * lifecycle.setFactory(() => new DatabaseService('connection-string'));
     * ```
     */
    public setFactory(factory: (...args: any[]) => any): void {
        if (this._isDisposed) {
            throw new Error('Cannot set factory on a disposed singleton lifecycle');
        }
        if (!factory || typeof factory !== 'function') {
            throw new Error('Factory must be a valid function');
        }
        this._factory = factory;
    }

    /**
     * Gets or creates the singleton instance.
     *
     * On the first call, this method creates the instance using the registered factory
     * and stores it for future use. All subsequent calls return the same instance,
     * regardless of the arguments passed.
     *
     * **Note:** Arguments are only used during the first creation. Subsequent calls
     * ignore any provided arguments and return the existing instance.
     *
     * @template T - The type of the service instance
     * @param {...any[]} args - Arguments to pass to the factory function (only used on first call)
     * @returns {T} The singleton instance
     * @throws {Error} If the lifecycle has been disposed
     * @throws {Error} If no factory has been registered
     * @throws {Error} If the factory function throws an error during instance creation
     *
     * @example
     * ```typescript
     * const lifecycle = new SingletonLifecycle();
     * lifecycle.setFactory((config) => new DatabaseService(config));
     *
     * // First call - creates the instance
     * const db1 = lifecycle.getInstance('connection-string');
     *
     * // Subsequent calls - returns same instance (ignores arguments)
     * const db2 = lifecycle.getInstance('different-string');
     * console.log(db1 === db2); // true
     * ```
     */
    public getInstance<T>(...args: any[]): T {
        if (this._isDisposed) {
            throw new Error('Cannot resolve from a disposed singleton lifecycle');
        }
        if (!this._factory) {
            throw new Error('No factory registered for this lifecycle');
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
                throw new Error(`Failed to resolve instance: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
            }
        }

        return this._instance as T;
    }

    /**
     * Creates a "scope" for the singleton lifecycle.
     *
     * Since singletons are shared across all scopes by design, this method returns
     * the same SingletonLifecycle instance (this). This ensures that the same
     * singleton instance is shared across all scopes in the application.
     *
     * @returns {SingletonLifecycle} The same SingletonLifecycle instance (this)
     *
     * @example
     * ```typescript
     * const lifecycle = new SingletonLifecycle();
     * const scope1 = lifecycle.createScope();
     * const scope2 = lifecycle.createScope();
     *
     * console.log(lifecycle === scope1); // true
     * console.log(scope1 === scope2); // true
     *
     * // All scopes return the same singleton instance
     * lifecycle.setFactory(() => new ConfigService());
     * const config1 = lifecycle.getInstance();
     * const config2 = scope1.getInstance();
     * const config3 = scope2.getInstance();
     * console.log(config1 === config2 && config2 === config3); // true
     * ```
     */
    public createScope(): SingletonLifecycle {
        // Singletons share the same instance across all scopes
        return this;
    }

    /**
     * Disposes the singleton lifecycle and its managed instance.
     *
     * This method is called when the root container is disposed (application shutdown).
     * If the singleton instance has a `dispose()` method, it will be called to allow
     * resource cleanup. After disposal, the lifecycle is permanently marked as disposed
     * and cannot be reused.
     *
     * **Note:** Child scope disposal does NOT trigger this — only the root container
     * disposes singletons. This is because `createScope()` returns `this`, and
     * `ServiceWrapper` sets `ownsLifecycle = false` for shared lifecycles.
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
            this._instance = undefined;
            this._initialized = false;
            this._factory = null;
        }
    }

    /**
     * Asynchronously disposes the singleton lifecycle. For a Promise instance,
     * it waits for the value and invokes that value's cleanup hook.
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
            this._instance = undefined;
            this._initialized = false;
            this._factory = null;
        }
    }

    /**
     * Returns the disposal state of this singleton lifecycle.
     *
     * @returns {boolean} True if disposed, false otherwise
     */
    public get isDisposed(): boolean {
        return this._isDisposed;
    }
}

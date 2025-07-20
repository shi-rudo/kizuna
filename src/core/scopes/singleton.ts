import type { Container } from '../../api/contracts/interfaces';

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
 * builder.addSingleton(r => r.fromType(DatabaseService));
 * 
 * // All requests return the same instance
 * const db1 = container.get(DatabaseService);
 * const db2 = container.get(DatabaseService);
 * console.log(db1 === db2); // true
 * 
 * // Same instance across different scopes
 * const scope1 = container.startScope();
 * const scope2 = container.startScope();
 * const db3 = scope1.get(DatabaseService);
 * const db4 = scope2.get(DatabaseService);
 * console.log(db1 === db3 && db3 === db4); // true
 * ```
 * 
 * @implements {Container}
 */
export class SingletonLifecycle implements Container {
    /**
     * The singleton instance (null until first creation).
     * @private
     */
    private _instance: any = null;
    
    /**
     * The factory function used to create the singleton instance.
     * @private
     */
    private _factory: ((...args: any[]) => any) | null = null;

    /**
     * Sets the factory function that will be used to create the singleton instance.
     * 
     * This method must be called before getInstance() to provide the creation logic.
     * The factory will only be called once, on the first request for the instance.
     * 
     * @param {Function} factory - The factory function that creates the service instance
     * @throws {Error} If factory is not a valid function
     * 
     * @example
     * ```typescript
     * const lifecycle = new SingletonLifecycle();
     * lifecycle.setFactory(() => new DatabaseService('connection-string'));
     * ```
     */
    public setFactory(factory: (...args: any[]) => any): void {
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
        if (!this._factory) {
            throw new Error('No factory registered for this lifecycle');
        }

        if (this._instance === null) {
            try {
                this._instance = this._factory(...args);
            } catch (error) {
                throw new Error(`Failed to resolve instance: ${error instanceof Error ? error.message : String(error)}`);
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
     * Disposes the singleton lifecycle.
     * 
     * **Important:** This method is intentionally empty for singleton lifecycles.
     * Singletons are designed to live for the entire application lifetime and should
     * not be disposed when individual scopes are disposed. Disposing a singleton
     * would break the contract that it remains available throughout the application.
     * 
     * If you need to clean up singleton resources, this should be done when the
     * entire application is shutting down, not when individual scopes are disposed.
     * 
     * @example
     * ```typescript
     * const lifecycle = new SingletonLifecycle();
     * lifecycle.setFactory(() => new DatabaseService());
     * const db = lifecycle.getInstance();
     * 
     * // This does nothing - singletons are not disposed
     * lifecycle.dispose();
     * 
     * // The instance is still available
     * const db2 = lifecycle.getInstance();
     * console.log(db === db2); // true
     * ```
     */
    public dispose(): void {
        // Singletons should not be disposed when individual scopes are disposed
        // They live for the application lifetime
        // This method is intentionally empty to preserve singleton behavior
    }

    /**
     * Indicates whether the singleton lifecycle has been disposed.
     * 
     * For singleton lifecycles, this always returns false because singletons
     * are never considered disposed during normal application operation. They
     * are designed to live for the entire application lifetime.
     * 
     * @returns {boolean} Always returns false for singleton lifecycles
     * 
     * @example
     * ```typescript
     * const lifecycle = new SingletonLifecycle();
     * console.log(lifecycle.isDisposed); // false
     * 
     * lifecycle.dispose(); // Does nothing
     * console.log(lifecycle.isDisposed); // Still false
     * ```
     */
    public get isDisposed(): boolean {
        return false; // Singletons are never considered disposed
    }
}
import type { Container } from '../../api/contracts/interfaces';

/**
 * Transient lifecycle implementation that creates a new instance every time.
 * 
 * This lifecycle strategy never caches instances - it creates a fresh instance
 * every time getInstance() is called. This is ideal for lightweight services
 * that don't maintain state or for services where you specifically need a
 * completely fresh instance each time (like loggers with timestamps, request IDs, etc.).
 * 
 * **Characteristics:**
 * - **Instance Creation**: Immediate (created every time requested)
 * - **Instance Sharing**: Never shared - always creates new instances
 * - **Memory Usage**: Variable (depends on how many instances are actively used)
 * - **Disposal**: Individual instances are not tracked by the lifecycle
 * - **Isolation**: Each request gets a completely independent instance
 * 
 * **Use Cases:**
 * - Lightweight stateless services
 * - Utility classes that don't hold state
 * - Services that need unique instances (UUID generators, timestamps)
 * - Data transfer objects (DTOs)
 * - Services where shared state would be problematic
 * 
 * @example
 * ```typescript
 * // Register a transient service
 * builder.addTransient(r => r.fromType(Logger));
 * 
 * // Every request creates a new instance
 * const logger1 = container.get(Logger);
 * const logger2 = container.get(Logger);
 * console.log(logger1 === logger2); // false - different instances
 * 
 * // Even within the same scope - still different instances
 * const scope = container.startScope();
 * const logger3 = scope.get(Logger);
 * const logger4 = scope.get(Logger);
 * console.log(logger3 === logger4); // false - always new instances
 * 
 * // Each instance is independent
 * logger1.log("Message 1");
 * logger2.log("Message 2"); // Different logger instance
 * ```
 * 
 * @implements {Container}
 */
export class TransientLifecycle implements Container {
    /**
     * The factory function used to create new instances.
     * @private
     */
    private _factory: ((...args: any[]) => any) | null = null;
    
    /**
     * Tracks whether this lifecycle has been disposed.
     * @private
     */
    private _isDisposed = false;

    /**
     * Sets the factory function that will be used to create new instances.
     * 
     * This method must be called before getInstance() to provide the creation logic.
     * The factory will be called every time getInstance() is requested, creating
     * a fresh instance each time.
     * 
     * @param {Function} factory - The factory function that creates service instances
     * @throws {Error} If the lifecycle has been disposed
     * @throws {Error} If factory is not a valid function
     * 
     * @example
     * ```typescript
     * const lifecycle = new TransientLifecycle();
     * lifecycle.setFactory(() => new RequestId(Date.now()));
     * 
     * // Each call to getInstance will create a new RequestId with current timestamp
     * ```
     */
    public setFactory(factory: (...args: any[]) => any): void {
        if (this._isDisposed) {
            throw new Error('Cannot use factory on disposed lifecycle');
        }
        if (!factory || typeof factory !== 'function') {
            throw new Error('Factory must be a valid function');
        }
        this._factory = factory;
    }

    /**
     * Creates and returns a new instance every time it's called.
     * 
     * This method always creates a fresh instance using the registered factory.
     * Unlike singleton or scoped lifecycles, transient lifecycles never cache
     * or reuse instances. Each call results in a completely new instance.
     * 
     * @template T - The type of the service instance
     * @param {...any[]} args - Arguments to pass to the factory function
     * @returns {T} A new instance of the service
     * @throws {Error} If no factory has been registered
     * @throws {Error} If the factory function throws an error during instance creation
     * 
     * @example
     * ```typescript
     * const lifecycle = new TransientLifecycle();
     * lifecycle.setFactory((message) => new Logger(message, Date.now()));
     * 
     * // Each call creates a new Logger with current timestamp
     * const logger1 = lifecycle.getInstance('First message');
     * await new Promise(resolve => setTimeout(resolve, 100));
     * const logger2 = lifecycle.getInstance('Second message');
     * 
     * console.log(logger1 === logger2); // false - different instances
     * console.log(logger1.timestamp !== logger2.timestamp); // true - different timestamps
     * ```
     */
    public getInstance<T>(...args: any[]): T {
        if (!this._factory) {
            throw new Error('No factory registered for this lifecycle');
        }
        try {
            return this._factory(...args) as T;
        } catch (error) {
            throw new Error(`Failed to resolve instance: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Creates a new transient lifecycle with the same factory configuration.
     * 
     * For transient lifecycles, creating a scope doesn't change the behavior
     * since each getInstance() call already creates a new instance. However,
     * this method maintains consistency with the Container interface and
     * provides a fresh TransientLifecycle instance with the same factory.
     * 
     * @returns {TransientLifecycle} A new TransientLifecycle instance with the same factory
     * @throws {Error} If this lifecycle has been disposed
     * @throws {Error} If no factory is available to copy to the new scope
     * 
     * @example
     * ```typescript
     * const lifecycle = new TransientLifecycle();
     * lifecycle.setFactory(() => new EventLogger());
     * 
     * // Create instances in original lifecycle
     * const logger1 = lifecycle.getInstance();
     * const logger2 = lifecycle.getInstance();
     * console.log(logger1 === logger2); // false - different instances
     * 
     * // Create a new scope
     * const newScope = lifecycle.createScope();
     * const logger3 = newScope.getInstance();
     * const logger4 = newScope.getInstance();
     * 
     * // All instances are different (transient behavior)
     * console.log(logger1 === logger3); // false
     * console.log(logger3 === logger4); // false
     * ```
     */
    public createScope(): TransientLifecycle {
        if (this._isDisposed) {
            throw new Error('Cannot create new scope from disposed lifecycle');
        }
        if (!this._factory) {
            throw new Error('No factory available to create new scope');
        }
        const lifecycle = new TransientLifecycle();
        lifecycle.setFactory(this._factory);
        return lifecycle;
    }

    /**
     * Disposes the transient lifecycle and cleans up resources.
     * 
     * This method clears the factory reference and marks the lifecycle as disposed.
     * Unlike scoped lifecycles, transient lifecycles don't track individual instances,
     * so only the factory and disposal state are managed.
     * 
     * Note: Individual instances created by this lifecycle are not automatically
     * disposed, as the lifecycle doesn't maintain references to them. If the
     * instances need disposal, they should implement their own cleanup logic.
     * 
     * @example
     * ```typescript
     * const lifecycle = new TransientLifecycle();
     * lifecycle.setFactory(() => new TemporaryService());
     * 
     * const service1 = lifecycle.getInstance();
     * const service2 = lifecycle.getInstance();
     * 
     * // Dispose the lifecycle
     * lifecycle.dispose();
     * 
     * // The lifecycle is now disposed
     * console.log(lifecycle.isDisposed); // true
     * 
     * // This would throw an error
     * // lifecycle.getInstance(); // Error: Cannot use factory on disposed lifecycle
     * 
     * // Note: service1 and service2 are still usable if they don't depend
     * // on the lifecycle being active
     * ```
     */
    public dispose(): void {
        if (!this._isDisposed) {
            this._factory = null;
            this._isDisposed = true;
        }
    }

    /**
     * Indicates whether this transient lifecycle has been disposed.
     * 
     * Once a transient lifecycle is disposed, it cannot be used to create
     * new instances or create new scopes. This property helps identify
     * disposed lifecycles and prevent their accidental reuse.
     * 
     * @returns {boolean} True if the lifecycle has been disposed, false otherwise
     * 
     * @example
     * ```typescript
     * const lifecycle = new TransientLifecycle();
     * console.log(lifecycle.isDisposed); // false
     * 
     * lifecycle.setFactory(() => new Service());
     * const service = lifecycle.getInstance();
     * 
     * lifecycle.dispose();
     * console.log(lifecycle.isDisposed); // true
     * 
     * // Trying to use disposed lifecycle throws error
     * try {
     *   lifecycle.getInstance();
     * } catch (error) {
     *   console.log(error.message); // "Cannot use factory on disposed lifecycle"
     * }
     * ```
     */
    public get isDisposed(): boolean {
        return this._isDisposed;
    }
}
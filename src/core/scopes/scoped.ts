import type { Container } from '../../api/contracts/interfaces';

/**
 * Interface for disposable services that can clean up their resources.
 * @private
 */
interface Disposable {
    dispose?(): void;
}

/**
 * Scoped lifecycle implementation that maintains one instance per scope.
 * 
 * This lifecycle strategy creates a new instance the first time it's requested within
 * a scope and reuses that instance for all subsequent requests within the same scope.
 * When a new scope is created, a fresh instance is created for that scope. This is
 * ideal for request-scoped services in web applications where you want isolation
 * between different requests but sharing within a single request.
 * 
 * **Characteristics:**
 * - **Instance Creation**: Lazy (created on first access within each scope)
 * - **Instance Sharing**: Shared within the same scope only
 * - **Memory Usage**: Medium (one instance per active scope)
 * - **Disposal**: Instance is disposed when the scope is disposed
 * - **Isolation**: Each scope has its own instance
 * 
 * **Use Cases:**
 * - Request-scoped services in web applications
 * - Database transactions (one per request)
 * - User context services
 * - Request-specific configuration
 * - Services that maintain state during a workflow
 * 
 * @example
 * ```typescript
 * // Register a scoped service
 * builder.addScoped(r => r.fromType(UserContext));
 * 
 * // Within the same scope - same instance
 * const scope1 = container.startScope();
 * const ctx1a = scope1.get(UserContext);
 * const ctx1b = scope1.get(UserContext);
 * console.log(ctx1a === ctx1b); // true
 * 
 * // Different scope - different instance
 * const scope2 = container.startScope();
 * const ctx2 = scope2.get(UserContext);
 * console.log(ctx1a === ctx2); // false
 * 
 * // Clean up when done
 * scope1.dispose(); // ctx1a/ctx1b are disposed
 * scope2.dispose(); // ctx2 is disposed
 * ```
 * 
 * @implements {Container}
 */
export class ScopedLifecycle implements Container {
    /**
     * The scoped instance (null until first creation).
     * @private
     */
    private _instance: any = null;
    
    /**
     * The factory function used to create instances within this scope.
     * @private
     */
    private _factory: ((...args: any[]) => any) | null = null;
    
    /**
     * Tracks whether this scope has been disposed.
     * @private
     */
    private _isDisposed = false;

    /**
     * Sets the factory function that will be used to create instances within this scope.
     * 
     * This method must be called before getInstance() to provide the creation logic.
     * The factory will be called once per scope when the first instance is requested.
     * 
     * @param {Function} factory - The factory function that creates the service instance
     * @throws {Error} If the scope has been disposed
     * @throws {Error} If factory is not a valid function
     * 
     * @example
     * ```typescript
     * const lifecycle = new ScopedLifecycle();
     * lifecycle.setFactory((userId) => new UserContext(userId));
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
     * Gets or creates the scoped instance within this scope.
     * 
     * On the first call within this scope, this method creates the instance using
     * the registered factory and stores it for reuse within the same scope. All
     * subsequent calls within the same scope return the same instance.
     * 
     * **Note:** Each scope maintains its own instance. Different scopes will have
     * different instances even if they use the same factory.
     * 
     * @template T - The type of the service instance
     * @param {...any[]} args - Arguments to pass to the factory function (only used on first call within scope)
     * @returns {T} The scoped instance
     * @throws {Error} If no factory has been registered
     * @throws {Error} If the factory function throws an error during instance creation
     * 
     * @example
     * ```typescript
     * const lifecycle = new ScopedLifecycle();
     * lifecycle.setFactory((userId) => new UserContext(userId));
     * 
     * // First call in this scope - creates the instance
     * const ctx1 = lifecycle.getInstance('user123');
     * 
     * // Subsequent calls in same scope - returns same instance
     * const ctx2 = lifecycle.getInstance('different-user');
     * console.log(ctx1 === ctx2); // true (arguments ignored after first call)
     * 
     * // New scope would create a new instance
     * const newScope = lifecycle.createScope();
     * const ctx3 = newScope.getInstance('user456');
     * console.log(ctx1 === ctx3); // false
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
     * Creates a new scope with the same factory configuration.
     * 
     * This method creates a fresh ScopedLifecycle instance that shares the same
     * factory function but maintains its own instance state. Each new scope will
     * create its own instance when getInstance() is first called, providing
     * isolation between different scopes.
     * 
     * @returns {ScopedLifecycle} A new ScopedLifecycle instance for the new scope
     * @throws {Error} If this scope has been disposed
     * @throws {Error} If no factory is available to copy to the new scope
     * 
     * @example
     * ```typescript
     * const lifecycle = new ScopedLifecycle();
     * lifecycle.setFactory(() => new RequestContext());
     * 
     * // Create the first instance in the original scope
     * const ctx1 = lifecycle.getInstance();
     * 
     * // Create a new scope - independent of the original
     * const newScope = lifecycle.createScope();
     * const ctx2 = newScope.getInstance();
     * 
     * console.log(ctx1 === ctx2); // false - different instances
     * 
     * // But within the same scope, instances are reused
     * const ctx3 = newScope.getInstance();
     * console.log(ctx2 === ctx3); // true - same scope, same instance
     * ```
     */
    public createScope(): ScopedLifecycle {
        if (this._isDisposed) {
            throw new Error('Cannot create new scope from disposed lifecycle');
        }
        if (!this._factory) {
            throw new Error('No factory available to create new scope');
        }
        const lifecycle = new ScopedLifecycle();
        lifecycle.setFactory(this._factory);
        return lifecycle;
    }

    /**
     * Disposes the scoped instance and cleans up resources.
     * 
     * This method disposes the current instance if it exists and implements the
     * dispose pattern. It also marks this scope as disposed, preventing further
     * use. If the instance has a dispose() method, it will be called to allow
     * the service to clean up its own resources.
     * 
     * After disposal, this scope cannot be used to create new instances or
     * create new scopes.
     * 
     * @example
     * ```typescript
     * const lifecycle = new ScopedLifecycle();
     * lifecycle.setFactory(() => new DatabaseTransaction());
     * 
     * const transaction = lifecycle.getInstance();
     * 
     * // Clean up when the scope is done
     * lifecycle.dispose();
     * 
     * // The scope is now disposed and cannot be used
     * console.log(lifecycle.isDisposed); // true
     * 
     * // This would throw an error
     * // lifecycle.getInstance(); // Error: Cannot use factory on disposed lifecycle
     * ```
     */
    public dispose(): void {
        if (!this._isDisposed) {
            // Dispose the instance if it implements IDisposable
            if (this._instance && typeof this._instance === 'object' && 'dispose' in this._instance) {
                try {
                    (this._instance as Disposable).dispose?.();
                } catch (error) {
                    // Log error but don't throw to avoid disposal chain breaking
                    console.warn('Error disposing scoped instance:', error);
                }
            }
            
            this._instance = null;
            this._factory = null;
            this._isDisposed = true;
        }
    }

    /**
     * Indicates whether this scope has been disposed.
     * 
     * Once a scope is disposed, it cannot be used to create instances or
     * create new scopes. This property helps identify disposed scopes and
     * prevent their accidental reuse.
     * 
     * @returns {boolean} True if the scope has been disposed, false otherwise
     * 
     * @example
     * ```typescript
     * const lifecycle = new ScopedLifecycle();
     * console.log(lifecycle.isDisposed); // false
     * 
     * lifecycle.dispose();
     * console.log(lifecycle.isDisposed); // true
     * 
     * // Trying to use disposed scope throws error
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
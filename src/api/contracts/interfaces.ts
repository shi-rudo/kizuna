import type { ServiceWrapper } from '../../core/services/service-wrapper';

/**
 * Container interface defines the contract for service lifecycle management.
 * 
 * This interface is implemented by lifecycle managers (Singleton, Scoped, Transient)
 * that control how and when service instances are created, cached, and disposed.
 * Each lifecycle type implements this interface differently to provide its specific
 * behavior.
 * 
 * @example
 * ```typescript
 * // Lifecycle implementations
 * const singleton = new SingletonLifecycle(); // implements Container
 * const scoped = new ScopedLifecycle();       // implements Container
 * const transient = new TransientLifecycle(); // implements Container
 * ```
 */
export interface Container {
    /**
     * Gets or creates an instance of the service.
     * 
     * @template T - The type of service to create
     * @param args - Arguments to pass to the service factory
     * @returns An instance of the service
     */
    getInstance<T>(...args: any): T;
    
    /**
     * Sets the factory function used to create service instances.
     * 
     * @param factory - The factory function that creates service instances
     */
    setFactory(factory: (...args: any) => any): void;
    
    /**
     * Creates a new scope for this container.
     * 
     * @returns A new container instance for scope isolation
     */
    createScope(): Container;
    
    /**
     * Disposes of any resources held by this container.
     * This method should clean up cached instances, close connections, etc.
     */
    dispose(): void;
}

/**
 * ServiceBuilder interface defines the contract for building service wrappers.
 * 
 * This interface is implemented by builder classes that can create ServiceWrapper
 * instances with the appropriate lifecycle management and dependency configuration.
 * 
 * @example
 * ```typescript
 * class MyServiceBuilder implements ServiceBuilder {
 *   build(lifecycleManager: Container): ServiceWrapper {
 *     // Configure lifecycle manager and create wrapper
 *     return new ServiceWrapper(name, lifecycleManager, dependencies);
 *   }
 * }
 * ```
 */
export interface ServiceBuilder {
    /**
     * Builds a ServiceWrapper with the specified lifecycle management.
     * 
     * @param lifecycleManager - The lifecycle implementation that will manage the service
     * @returns A configured ServiceWrapper ready for dependency injection
     */
    build(lifecycleManager: Container): ServiceWrapper;
}

/**
 * ServiceRegistration interface represents a complete service registration.
 * 
 * This interface extends ServiceBuilder and represents a service that has been
 * fully configured and is ready to be built into a ServiceWrapper. It indicates
 * that all necessary configuration (factory, dependencies, etc.) has been provided.
 * 
 * @extends ServiceBuilder
 * 
 * @example
 * ```typescript
 * // A registration that's ready to be built
 * const registration: ServiceRegistration = builder
 *   .fromType(UserService)
 *   .withDependencies(DatabaseService);
 * ```
 */
export interface ServiceRegistration extends ServiceBuilder { }

/**
 * PendingService interface represents a service registration that may still need dependencies.
 * 
 * This interface extends ServiceBuilder and provides the ability to configure dependencies
 * before the service registration is complete. It's typically used in the fluent API
 * when a service has been specified but dependencies haven't been configured yet.
 * 
 * @extends ServiceBuilder
 * 
 * @example
 * ```typescript
 * // Create a pending service
 * const pending: PendingService = builder.fromType(UserService);
 * 
 * // Configure dependencies to complete the registration
 * const registration: ServiceRegistration = pending.withDependencies(
 *   DatabaseService, 
 *   'LoggerService'
 * );
 * ```
 */
export interface PendingService extends ServiceBuilder {
    /**
     * Configures the dependencies for this service.
     * 
     * @param dependencies - Array of dependency identifiers (constructor functions or string names)
     * @returns A complete ServiceRegistration ready to be built
     * 
     * @example
     * ```typescript
     * // Mix of constructor and string dependencies
     * pending.withDependencies(DatabaseService, 'ILogger', ApiClient);
     * ```
     */
    withDependencies(...dependencies: (string | (new (...args: any) => any))[]): ServiceRegistration;
}

/**
 * ServiceLocator interface defines the contract for service resolution and container management.
 * 
 * This interface is implemented by ServiceProvider and provides the main API for resolving
 * services from the dependency injection container. It supports service resolution by both
 * string keys and constructor types, scope management, and resource cleanup.
 * 
 * @example
 * ```typescript
 * const serviceLocator: ServiceLocator = containerBuilder.build();
 * 
 * // Resolve services
 * const userService = serviceLocator.get(UserService);
 * const apiClient = serviceLocator.get<IApiClient>('ApiClient');
 * 
 * // Manage scopes
 * const scope = serviceLocator.startScope();
 * scope.dispose();
 * ```
 */
export interface ServiceLocator {
    /**
     * Resolves a service by string key.
     * 
     * @template T - The expected type of the service
     * @param objToImplement - The string key identifying the service
     * @returns An instance of the requested service
     * @throws {Error} If no service is registered for the given key
     */
    get<T>(objToImplement: string): T;
    
    /**
     * Resolves a service by constructor type.
     * 
     * @template T - The constructor type of the service
     * @param objToImplement - The constructor function of the service
     * @returns An instance of the requested service
     * @throws {Error} If no service is registered for the given type
     */
    get<T extends new (...args: any) => any>(objToImplement: T): InstanceType<T>;
    
    /**
     * Creates a new scope for isolated service resolution.
     * 
     * Scoped services will have new instances created within the new scope,
     * while singleton services remain shared across all scopes.
     * 
     * @returns A new ServiceLocator instance representing the new scope
     */
    startScope(): ServiceLocator;
    
    /**
     * Disposes of all services and cleans up resources.
     * 
     * This method should be called when the service locator is no longer needed
     * to ensure proper cleanup of disposable services and prevent resource leaks.
     */
    dispose(): void;
}
<<<<<<< HEAD
=======

/**
 * Type-safe ServiceLocator that provides compile-time safety and IDE autocompletion.
 * 
 * @template TRegistry - The service registry type mapping string keys to service types
 */
export interface TypeSafeServiceLocator<TRegistry extends Record<string, any>> {
    /**
     * Type-safe service resolution by string key with autocompletion and type inference.
     * 
     * @template K - The string key from the registry
     * @param key - The string key identifying the service (must be registered)
     * @returns An instance of the service with inferred type
     */
    get<K extends keyof TRegistry>(key: K): TRegistry[K];
    
    /**
     * Resolves a service by constructor type.
     * 
     * @template T - The constructor type of the service
     * @param objToImplement - The constructor function of the service
     * @returns An instance of the requested service
     */
    get<T extends new (...args: any) => any>(objToImplement: T): InstanceType<T>;
    
    /**
     * Creates a new scope with the same type safety.
     * 
     * @returns A new TypeSafeServiceLocator instance with the same registry
     */
    startScope(): TypeSafeServiceLocator<TRegistry>;
    
    /**
     * Disposes of all services and cleans up resources.
     */
    dispose(): void;
}
>>>>>>> 90d0f39 (Initial commit with type safety changes)

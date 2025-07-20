import { SingletonLifecycle } from "../core/scopes/singleton";
import { ServiceWrapper } from "../core/services/service-wrapper";
import type { ServiceLocator } from "./contracts/interfaces";
import type { ServiceKey } from "./contracts/types";

/**
 * ServiceProvider is a dependency injection container that implements the ServiceLocator pattern.
 * It manages the lifecycle of registered services and provides methods to resolve dependencies.
 * 
 * The ServiceProvider is typically created by ContainerBuilder.build() and serves as the
 * runtime container for your application's dependency injection needs. It handles service
 * resolution, dependency injection, lifecycle management, and scope creation.
 * 
 * Key Features:
 * - **Service Resolution**: Resolve services by type or string key
 * - **Dependency Injection**: Automatically inject dependencies into services
 * - **Lifecycle Management**: Manage singleton, scoped, and transient service lifetimes
 * - **Scope Creation**: Create new scopes for request-level service isolation
 * - **Error Handling**: Comprehensive error messages for debugging
 * 
 * @implements {ServiceLocator}
 * 
 * @example
 * ```typescript
 * // Typically created via ContainerBuilder
 * const builder = new ContainerBuilder();
 * builder.addSingleton(r => r.fromType(DatabaseService));
 * builder.addScoped(r => r.fromType(UserService).withDependencies(DatabaseService));
 * 
 * const serviceProvider = builder.build();
 * 
 * // Resolve services
 * const userService = serviceProvider.get(UserService);
 * const dbService = serviceProvider.get(DatabaseService);
 * ```
 * 
 * @example
 * ```typescript
 * // Working with scopes
 * const rootProvider = builder.build();
 * 
 * // Create a new scope (useful for request isolation)
 * const scopedProvider = rootProvider.startScope();
 * const userService1 = scopedProvider.get(UserService); // New scoped instance
 * const userService2 = scopedProvider.get(UserService); // Same scoped instance
 * 
 * // Different scope, different instances
 * const anotherScope = rootProvider.startScope();
 * const userService3 = anotherScope.get(UserService); // Different instance
 * ```
 */
export class ServiceProvider implements ServiceLocator {
    /**
     * A registry mapping service names to their respective ServiceWrappers.
     * This immutable registry contains all the service definitions and their
     * associated lifecycle management and dependency information.
     * 
     * @private
     * @readonly
     */
    private readonly registrations: Readonly<Record<string, ServiceWrapper>>;

    /**
     * Creates a new instance of ServiceProvider with the given registrations.
     * 
     * This constructor is typically called by ContainerBuilder.build() rather than
     * directly by application code. It initializes the service provider with all
     * registered services and automatically registers itself as a service.
     * 
     * @param {Record<string, ServiceWrapper>} registrations - Initial service registrations
     *   containing all configured services with their lifecycle management and dependencies
     * @throws {Error} If registrations is null or undefined
     * 
     * @example
     * ```typescript
     * // Usually created via ContainerBuilder
     * const registrations = {}; // service registrations
     * const provider = new ServiceProvider(registrations);
     * ```
     */
    constructor(registrations: Record<string, ServiceWrapper>) {
        if (!registrations) {
            throw new Error("Registrations cannot be null or undefined");
        }
        this.registrations = { ...registrations };
        this.addItSelfResolver();
    }

    /**
     * Resolves and returns an instance of the requested service.
     * 
     * This method is the primary way to retrieve services from the container.
     * It handles dependency injection, lifecycle management, and returns a fully
     * configured service instance. The service's dependencies are automatically
     * resolved and injected.
     * 
     * @template T - The type of the service to resolve
     * @param {ServiceKey<T>} key - The service key (string or constructor) to resolve
     * @returns {T} An instance of the requested service
     * @throws {Error} If no service is registered for the given key
     * @throws {Error} If service resolution fails due to dependency issues
     * 
     * @example
     * ```typescript
     * // Resolve by constructor type
     * const userService = provider.get(UserService);
     * 
     * // Resolve by string key
     * const apiClient = provider.get<IApiClient>('ApiClient');
     * 
     * // Resolve singleton - same instance every time
     * const config1 = provider.get(ConfigService);
     * const config2 = provider.get(ConfigService);
     * // config1 === config2 (if registered as singleton)
     * ```
     */
    get<T>(key: ServiceKey<T>): T {
        const typeName = this.getTypeName(key);
        const resolver = this.registrations[typeName];

        if (!resolver) {
            throw new Error(`No service registered for key: ${typeName}`);
        }

        try {
            return resolver.resolve(this) as T;
        } catch (error) {
            throw new Error(
                `Failed to resolve service ${typeName}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Creates a new scope based on the current registrations.
     * 
     * Scopes are useful for creating isolated service contexts, particularly in web applications
     * where you want to maintain separate service instances per request. Services registered
     * as 'scoped' will have new instances created for each scope, while singletons remain
     * shared across all scopes.
     * 
     * @returns {ServiceLocator} A new ServiceProvider instance with the same registrations but a new scope
     * 
     * @example
     * ```typescript
     * const rootProvider = builder.build();
     * 
     * // Create request-specific scopes
     * const requestScope1 = rootProvider.startScope();
     * const requestScope2 = rootProvider.startScope();
     * 
     * // Scoped services will be different instances
     * const userService1 = requestScope1.get(UserService);
     * const userService2 = requestScope2.get(UserService);
     * // userService1 !== userService2
     * 
     * // But singletons remain the same
     * const config1 = requestScope1.get(ConfigService);
     * const config2 = requestScope2.get(ConfigService);
     * // config1 === config2 (if ConfigService is singleton)
     * ```
     */
    startScope(): ServiceLocator {
        const newRegistrations: Record<string, ServiceWrapper> = {};

        Object.entries(this.registrations).forEach(([key, resolver]) => {
            newRegistrations[key] = resolver.createScope();
        });

        return new ServiceProvider(newRegistrations);
    }

    /**
     * Disposes all registered services that implement the disposable pattern.
     * 
     * This method should be called when the container is no longer needed to properly
     * clean up resources like database connections, file handles, timers, etc.
     * It iterates through all registered services and calls their dispose methods if available.
     * 
     * Disposal errors are caught and logged to prevent one failing service from
     * blocking the disposal of others.
     * 
     * @example
     * ```typescript
     * const provider = builder.build();
     * 
     * try {
     *   // Use the provider...
     *   const service = provider.get(MyService);
     * } finally {
     *   // Always dispose to clean up resources
     *   provider.dispose();
     * }
     * ```
     * 
     * @example
     * ```typescript
     * // In a web application
     * const requestScope = rootProvider.startScope();
     * 
     * try {
     *   // Handle request...
     * } finally {
     *   // Dispose scope when request is complete
     *   requestScope.dispose();
     * }
     * ```
     */
    dispose(): void {
        Object.values(this.registrations).forEach((resolver) => {
            try {
                resolver.dispose?.();
            } catch (error) {
                console.error("Error disposing resolver:", error);
            }
        });
    }

    /**
     * Extracts the name from a service key (string or constructor).
     * @private
     * @template T - The service type.
     * @param {ServiceKey<T>} keyOrType - Either a string key or a constructor function.
     * @returns {string} The name of the service.
     */
    private getTypeName<T>(keyOrType: ServiceKey<T>): string {
        return typeof keyOrType === "string" ? keyOrType : keyOrType.name;
    }

    /**
     * Registers the ServiceProvider itself in the container as a singleton.
     * This allows services to request the ServiceProvider for advanced scenarios.
     * @private
     */
    private addItSelfResolver(): void {
        const lifecycle = new SingletonLifecycle();
        lifecycle.setFactory(() => this);

        // Use type assertion to bypass readonly modifier for this initialization
        (this.registrations as Record<string, ServiceWrapper>)[
            ServiceProvider.name
        ] = new ServiceWrapper(ServiceProvider.name, lifecycle, []);
    }
}

import { TypeSafeRegistrarImpl } from "../core/builders/type-safe-registrar";
import { ScopedLifecycle } from "../core/scopes/scoped";
import { SingletonLifecycle } from "../core/scopes/singleton";
import { TransientLifecycle } from "../core/scopes/transient";
import { BaseContainerBuilder } from "./base-container-builder";
import type {
    Container,
    TypeSafeServiceLocator,
} from "./contracts/interfaces";
import type { ServiceRegistry, TypeSafeRegistrar } from "./contracts/types";
import { ServiceProvider } from "./service-provider";

/**
 * ContainerBuilder provides a unified, fully type-safe API for dependency injection.
 * Combines all registration patterns with complete type safety and IDE autocompletion.
 *
 * Features:
 * - **Full type safety**: Compile-time type checking with automatic type inference
 * - **Multiple registration patterns**: Constructor-based, interface-based, and factory-based
 * - **All lifecycles**: Singleton, scoped, and transient service lifetimes
 * - **Factory functions**: Support for complex service initialization with type-safe providers
 * - **Interface registration**: Type-safe interface-to-implementation mapping
 * - **Dependency injection**: Automatic resolution of service dependencies
 *
 * @template TRegistry - The service registry type tracking registered services
 *
 * @example
 * ```typescript
 * // The ultimate type-safe container - all patterns in one!
 * const container = new ContainerBuilder()
 *   // Constructor-based registration
 *   .registerSingleton('Logger', ConsoleLogger)
 *   .registerScoped('UserService', UserService, 'Logger')
 *   
 *   // Interface-based registration  
 *   .registerSingletonInterface<IDatabase>('IDatabase', DatabaseService, 'Logger')
 *   .registerScopedInterface<ICache>('ICache', RedisCache, 'Logger')
 *   
 *   // Factory-based registration
 *   .registerSingletonFactory('Config', (provider) => {
 *     const logger = provider.get('Logger'); // Type: ConsoleLogger
 *     return { env: 'production', debug: false };
 *   })
 *   .registerScopedFactory('RequestId', () => crypto.randomUUID())
 *   
 *   .build();
 * 
 * // Fully type-safe resolution
 * const logger = container.get('Logger');        // Type: ConsoleLogger
 * const userService = container.get('UserService'); // Type: UserService  
 * const database = container.get('IDatabase');   // Type: IDatabase
 * const config = container.get('Config');        // Type: { env: string; debug: boolean }
 * ```
 *
 */
export class ContainerBuilder<TRegistry extends ServiceRegistry = {}> extends BaseContainerBuilder {
    // =================
    // CONSTRUCTOR-BASED REGISTRATION
    // =================

    /**
     * Registers a service with singleton lifetime using constructor and dependencies.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from constructor)
     * @param key - The string key used to identify the service
     * @param serviceType - The service constructor
     * @param dependencies - Optional dependency keys
     * @returns A new ContainerBuilder with the updated registry type
     */
    registerSingleton<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        ...dependencies: string[]
    ): ContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useType(serviceType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new SingletonLifecycle());
    }

    /**
     * Registers a service with scoped lifetime using constructor and dependencies.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from constructor)
     * @param key - The string key used to identify the service
     * @param serviceType - The service constructor
     * @param dependencies - Optional dependency keys
     * @returns A new ContainerBuilder with the updated registry type
     */
    registerScoped<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        ...dependencies: string[]
    ): ContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useType(serviceType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new ScopedLifecycle());
    }

    /**
     * Registers a service with transient lifetime using constructor and dependencies.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from constructor)
     * @param key - The string key used to identify the service
     * @param serviceType - The service constructor
     * @param dependencies - Optional dependency keys
     * @returns A new ContainerBuilder with the updated registry type
     */
    registerTransient<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        ...dependencies: string[]
    ): ContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useType(serviceType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new TransientLifecycle());
    }

    // =================
    // INTERFACE-BASED REGISTRATION
    // =================

    /**
     * Registers an interface implementation with singleton lifetime.
     * 
     * @template TInterface - The interface type being registered
     * @template K - The string key for the service
     * @param key - The string key used to identify the service
     * @param implementationType - The concrete implementation constructor
     * @param dependencies - Optional dependency keys
     * @returns A new ContainerBuilder with the updated registry type
     */
    registerSingletonInterface<TInterface, K extends string = string>(
        key: K,
        implementationType: new (...args: any[]) => TInterface,
        ...dependencies: string[]
    ): ContainerBuilder<TRegistry & Record<K, TInterface>> {
        const configurator = (registrar: TypeSafeRegistrar<TInterface>) => {
            registrar.useType(implementationType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new SingletonLifecycle());
    }

    /**
     * Registers an interface implementation with scoped lifetime.
     * 
     * @template TInterface - The interface type being registered
     * @template K - The string key for the service
     * @param key - The string key used to identify the service
     * @param implementationType - The concrete implementation constructor
     * @param dependencies - Optional dependency keys
     * @returns A new ContainerBuilder with the updated registry type
     */
    registerScopedInterface<TInterface, K extends string = string>(
        key: K,
        implementationType: new (...args: any[]) => TInterface,
        ...dependencies: string[]
    ): ContainerBuilder<TRegistry & Record<K, TInterface>> {
        const configurator = (registrar: TypeSafeRegistrar<TInterface>) => {
            registrar.useType(implementationType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new ScopedLifecycle());
    }

    /**
     * Registers an interface implementation with transient lifetime.
     * 
     * @template TInterface - The interface type being registered
     * @template K - The string key for the service
     * @param key - The string key used to identify the service
     * @param implementationType - The concrete implementation constructor
     * @param dependencies - Optional dependency keys
     * @returns A new ContainerBuilder with the updated registry type
     */
    registerTransientInterface<TInterface, K extends string = string>(
        key: K,
        implementationType: new (...args: any[]) => TInterface,
        ...dependencies: string[]
    ): ContainerBuilder<TRegistry & Record<K, TInterface>> {
        const configurator = (registrar: TypeSafeRegistrar<TInterface>) => {
            registrar.useType(implementationType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new TransientLifecycle());
    }

    // =================
    // FACTORY-BASED REGISTRATION
    // =================

    /**
     * Registers a service using a factory function with singleton lifetime.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from factory return)
     * @param key - The string key used to identify the service
     * @param factory - Factory function that creates the service with type-safe provider access
     * @returns A new ContainerBuilder with the updated registry type
     */
    registerSingletonFactory<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
    ): ContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useFactory(factory);
        };
        return this.registerTypeSafe(key, configurator, new SingletonLifecycle());
    }

    /**
     * Registers a service using a factory function with scoped lifetime.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from factory return)
     * @param key - The string key used to identify the service
     * @param factory - Factory function that creates the service with type-safe provider access
     * @returns A new ContainerBuilder with the updated registry type
     */
    registerScopedFactory<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
    ): ContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useFactory(factory);
        };
        return this.registerTypeSafe(key, configurator, new ScopedLifecycle());
    }

    /**
     * Registers a service using a factory function with transient lifetime.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from factory return)
     * @param key - The string key used to identify the service
     * @param factory - Factory function that creates the service with type-safe provider access
     * @returns A new ContainerBuilder with the updated registry type
     */
    registerTransientFactory<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
    ): ContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useFactory(factory);
        };
        return this.registerTypeSafe(key, configurator, new TransientLifecycle());
    }

    // =================
    // BUILD METHOD
    // =================

    /**
     * Builds the fully type-safe service container.
     * 
     * @returns The configured type-safe service locator with complete type inference
     * @throws {Error} If the builder has already been built
     * 
     * @example
     * ```typescript
     * const container = new ContainerBuilder()
     *   .registerSingleton('Logger', ConsoleLogger)
     *   .registerSingletonFactory('Config', () => ({ env: 'dev' }))
     *   .build();
     * 
     * const logger = container.get('Logger'); // Type: ConsoleLogger
     * const config = container.get('Config'); // Type: { env: string }
     * ```
     */
    build(): TypeSafeServiceLocator<TRegistry> {
        this.ensureNotBuilt();
        this.markAsBuilt();

        if (this.registrations.size === 0) {
            this.logWarning("Building ServiceProvider with no registered services");
        }

        const registrationsObject = Object.fromEntries(this.registrations);
        return new ServiceProvider<TRegistry>(registrationsObject);
    }

    // =================
    // INTERNAL HELPERS
    // =================

    /**
     * Internal method to handle type-safe service registration.
     * @private
     */
    private registerTypeSafe<K extends string, T>(
        key: K,
        configurator: (registrar: TypeSafeRegistrar<T>) => void,
        lifecycle: Container
    ): ContainerBuilder<TRegistry & Record<K, T>> {
        this.ensureNotBuilt();

        const registrar = new TypeSafeRegistrarImpl<T>(key);
        configurator(registrar);
        
        const serviceWrapper = registrar.build(lifecycle);
        this.validateServiceName(key);
        this.registerService(key, serviceWrapper);

        // Return this instance with updated type (cast)
        return this as unknown as ContainerBuilder<TRegistry & Record<K, T>>;
    }
}
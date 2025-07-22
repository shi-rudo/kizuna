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
import { TypeSafeServiceProvider } from "./type-safe-service-provider";

/**
 * FluentContainerBuilder provides a type-safe API for configuring dependency injection services
 * with fluent method chaining and automatic type inference.
 *
 * Features:
 * - **Type safety**: Full compile-time type checking with IDE autocompletion
 * - **Factory functions**: Support for complex service initialization
 * - **Multiple lifecycles**: Singleton, scoped, and transient service lifetimes
 * - **Dependency injection**: Automatic resolution of service dependencies
 *
 * @template TRegistry - The service registry type tracking registered services
 *
 * @example
 * ```typescript
 * // Type-safe fluent registration
 * const container = new FluentContainerBuilder()
 *   .registerSingleton('Logger', ConsoleLogger)
 *   .registerScoped('UserService', UserService, 'Logger')
 *   .registerFactory('Config', () => ({ env: 'dev' }))
 *   .build();
 * 
 * const logger = container.get('Logger'); // Type: ConsoleLogger
 * const userService = container.get('UserService'); // Type: UserService
 * ```
 *
 */
export class FluentContainerBuilder<TRegistry extends ServiceRegistry = {}> extends BaseContainerBuilder {
    /**
     * Type-safe singleton service registration with constructor and dependencies.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from constructor)
     * @param key - The string key used to identify the service
     * @param serviceType - The service constructor
     * @param dependencies - Optional dependency keys
     * @returns A new FluentContainerBuilder with the updated registry type
     */
    registerSingleton<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        ...dependencies: string[]
    ): FluentContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useType(serviceType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new SingletonLifecycle());
    }

    /**
     * Type-safe scoped service registration with constructor and dependencies.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from constructor)
     * @param key - The string key used to identify the service
     * @param serviceType - The service constructor
     * @param dependencies - Optional dependency keys
     * @returns A new FluentContainerBuilder with the updated registry type
     */
    registerScoped<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        ...dependencies: string[]
    ): FluentContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useType(serviceType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new ScopedLifecycle());
    }

    /**
     * Type-safe transient service registration with constructor and dependencies.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from constructor)
     * @param key - The string key used to identify the service
     * @param serviceType - The service constructor
     * @param dependencies - Optional dependency keys
     * @returns A new FluentContainerBuilder with the updated registry type
     */
    registerTransient<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        ...dependencies: string[]
    ): FluentContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useType(serviceType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new TransientLifecycle());
    }

    /**
     * Type-safe factory registration with singleton lifetime.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from factory return)
     * @param key - The string key used to identify the service
     * @param factory - Factory function that creates the service with type-safe provider access
     * @returns A new FluentContainerBuilder with the updated registry type
     */
    registerFactory<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
    ): FluentContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useFactory(factory);
        };
        return this.registerTypeSafe(key, configurator, new SingletonLifecycle());
    }

    /**
     * Type-safe scoped factory registration.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from factory return)
     * @param key - The string key used to identify the service
     * @param factory - Factory function that creates the service with type-safe provider access
     * @returns A new FluentContainerBuilder with the updated registry type
     */
    registerScopedFactory<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
    ): FluentContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useFactory(factory);
        };
        return this.registerTypeSafe(key, configurator, new ScopedLifecycle());
    }

    /**
     * Type-safe transient factory registration.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from factory return)
     * @param key - The string key used to identify the service
     * @param factory - Factory function that creates the service with type-safe provider access
     * @returns A new FluentContainerBuilder with the updated registry type
     */
    registerTransientFactory<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
    ): FluentContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useFactory(factory);
        };
        return this.registerTypeSafe(key, configurator, new TransientLifecycle());
    }





    /**
     * Builds the service provider from the registered services with full type safety.
     * 
     * @returns {TypeSafeServiceLocator<TRegistry>} The configured type-safe service provider
     * @throws {Error} If the service collection has already been built
     * 
     * @example
     * ```typescript
     * const container = new FluentContainerBuilder()
     *   .registerSingleton('Logger', ConsoleLogger)
     *   .build();
     * 
     * const logger = container.get('Logger'); // Type: ConsoleLogger
     * ```
     */
    build(): TypeSafeServiceLocator<TRegistry> {
        this.ensureNotBuilt();
        this.markAsBuilt();

        if (this.registrations.size === 0) {
            this.logWarning("Building ServiceProvider with no registered services");
        }

        const registrationsObject = Object.fromEntries(this.registrations);
        return new TypeSafeServiceProvider<TRegistry>(registrationsObject);
    }

    /**
     * Internal method to handle type-safe service registration.
     * 
     * @private
     */
    private registerTypeSafe<K extends string, T>(
        key: K,
        configurator: (registrar: TypeSafeRegistrar<T>) => void,
        lifecycle: Container
    ): FluentContainerBuilder<TRegistry & Record<K, T>> {
        this.ensureNotBuilt();

        const registrar = new TypeSafeRegistrarImpl<T>(key);
        configurator(registrar);
        
        const serviceWrapper = registrar.build(lifecycle);
        this.validateServiceName(key);
        this.registerService(key, serviceWrapper);

        // Return this instance with updated type (cast)
        return this as unknown as FluentContainerBuilder<TRegistry & Record<K, T>>;
    }

}
import { TypeSafeRegistrarImpl } from "../core/builders/type-safe-registrar";
import { ScopedLifecycle } from "../core/scopes/scoped";
import { SingletonLifecycle } from "../core/scopes/singleton";
import { TransientLifecycle } from "../core/scopes/transient";
import { BaseContainerBuilder } from "./base-container-builder";
import type {
    TypeSafeServiceLocator,
} from "./contracts/interfaces";
import type { ServiceRegistry, TypeSafeRegistrar } from "./contracts/types";
import { TypeSafeServiceProvider } from "./type-safe-service-provider";
import type { Container } from "./contracts/interfaces";

/**
 * TypeSafeContainerBuilder provides a type-safe API for configuring dependency injection services.
 * It offers compile-time type checking, IDE autocompletion, and automatic type inference.
 *
 * The TypeSafeContainerBuilder supports three main service lifecycles:
 * - **Singleton**: One instance per application lifetime
 * - **Scoped**: One instance per scope (useful for request-scoped services)
 * - **Transient**: New instance every time the service is requested
 *
 * @template TRegistry - The service registry type tracking registered services
 *
 * @example
 * ```typescript
 * // Type-safe registration with automatic type inference
 * const container = new TypeSafeContainerBuilder()
 *   .registerSingleton("Logger", ConsoleLogger)
 *   .registerScoped("UserService", UserService, "Logger")
 *   .buildTypeSafe();
 * 
 * const logger = container.get("Logger"); // Type inferred as ConsoleLogger
 * ```
 *
 * @example
 * ```typescript
 * // Interface-based registration
 * const container = new TypeSafeContainerBuilder()
 *   .registerInterface<ILogger>('ILogger', ConsoleLogger)
 *   .registerInterface<IDatabase>('IDatabase', DatabaseService, 'ILogger')
 *   .buildTypeSafe();
 * 
 * const logger = container.get('ILogger'); // Type: ILogger
 * ```
 */
export class TypeSafeContainerBuilder<TRegistry extends ServiceRegistry = {}> extends BaseContainerBuilder {
    /**
     * Type-safe singleton service registration with constructor and dependencies.
     * 
     * @template K - The string key for the service
     * @template T - The service type (inferred from constructor)
     * @param key - The string key used to identify the service
     * @param serviceType - The service constructor
     * @param dependencies - Optional dependency keys
     * @returns A new TypeSafeContainerBuilder with the updated registry type
     * 
     * @example
     * ```typescript
     * const container = new TypeSafeContainerBuilder()
     *   .registerSingleton('Logger', ConsoleLogger)
     *   .registerSingleton('Database', DatabaseService, 'Logger')
     *   .buildTypeSafe();
     * ```
     */
    registerSingleton<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        ...dependencies: string[]
    ): TypeSafeContainerBuilder<TRegistry & Record<K, T>> {
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
     * @returns A new TypeSafeContainerBuilder with the updated registry type
     * 
     * @example
     * ```typescript
     * const container = new TypeSafeContainerBuilder()
     *   .registerScoped('RequestContext', RequestContext)
     *   .registerScoped('UserService', UserService, 'RequestContext')
     *   .buildTypeSafe();
     * ```
     */
    registerScoped<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        ...dependencies: string[]
    ): TypeSafeContainerBuilder<TRegistry & Record<K, T>> {
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
     * @returns A new TypeSafeContainerBuilder with the updated registry type
     * 
     * @example
     * ```typescript
     * const container = new TypeSafeContainerBuilder()
     *   .registerTransient('EmailService', EmailService, 'SmtpClient')
     *   .registerTransient('Logger', FileLogger)
     *   .buildTypeSafe();
     * ```
     */
    registerTransient<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        ...dependencies: string[]
    ): TypeSafeContainerBuilder<TRegistry & Record<K, T>> {
        const configurator = (registrar: TypeSafeRegistrar<T>) => {
            registrar.useType(serviceType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new TransientLifecycle());
    }

    /**
     * Type-safe interface registration with singleton lifetime.
     * Allows registering a concrete implementation for an interface type.
     * 
     * @template TInterface - The interface type being registered
     * @template K - The string key for the service
     * @param key - The string key used to identify the service
     * @param implementationType - The concrete implementation constructor
     * @param dependencies - Optional dependency keys
     * @returns A new TypeSafeContainerBuilder with the updated registry type
     * 
     * @example
     * ```typescript
     * interface ILogger { log(message: string): void; }
     * class ConsoleLogger implements ILogger { log(msg: string) { console.log(msg); } }
     * 
     * const container = new TypeSafeContainerBuilder()
     *   .registerInterface<ILogger>('ILogger', ConsoleLogger)
     *   .buildTypeSafe();
     * 
     * const logger = container.get('ILogger'); // Type: ILogger
     * ```
     */
    registerInterface<TInterface, K extends string = string>(
        key: K,
        implementationType: new (...args: any[]) => TInterface,
        ...dependencies: string[]
    ): TypeSafeContainerBuilder<TRegistry & Record<K, TInterface>> {
        const configurator = (registrar: TypeSafeRegistrar<TInterface>) => {
            registrar.useType(implementationType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new SingletonLifecycle());
    }

    /**
     * Type-safe interface registration with scoped lifetime.
     * Allows registering a concrete implementation for an interface type with scoped lifecycle.
     * 
     * @template TInterface - The interface type being registered
     * @template K - The string key for the service
     * @param key - The string key used to identify the service
     * @param implementationType - The concrete implementation constructor
     * @param dependencies - Optional dependency keys
     * @returns A new TypeSafeContainerBuilder with the updated registry type
     * 
     * @example
     * ```typescript
     * const container = new TypeSafeContainerBuilder()
     *   .registerScopedInterface<IUserRepository>('IUserRepository', DatabaseUserRepository, 'IDatabase')
     *   .buildTypeSafe();
     * ```
     */
    registerScopedInterface<TInterface, K extends string = string>(
        key: K,
        implementationType: new (...args: any[]) => TInterface,
        ...dependencies: string[]
    ): TypeSafeContainerBuilder<TRegistry & Record<K, TInterface>> {
        const configurator = (registrar: TypeSafeRegistrar<TInterface>) => {
            registrar.useType(implementationType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new ScopedLifecycle());
    }

    /**
     * Type-safe interface registration with transient lifetime.
     * Allows registering a concrete implementation for an interface type with transient lifecycle.
     * 
     * @template TInterface - The interface type being registered
     * @template K - The string key for the service
     * @param key - The string key used to identify the service
     * @param implementationType - The concrete implementation constructor
     * @param dependencies - Optional dependency keys
     * @returns A new TypeSafeContainerBuilder with the updated registry type
     * 
     * @example
     * ```typescript
     * const container = new TypeSafeContainerBuilder()
     *   .registerTransientInterface<INotificationService>('IEmailNotifier', EmailNotificationService)
     *   .registerTransientInterface<INotificationService>('ISmsNotifier', SmsNotificationService)
     *   .buildTypeSafe();
     * ```
     */
    registerTransientInterface<TInterface, K extends string = string>(
        key: K,
        implementationType: new (...args: any[]) => TInterface,
        ...dependencies: string[]
    ): TypeSafeContainerBuilder<TRegistry & Record<K, TInterface>> {
        const configurator = (registrar: TypeSafeRegistrar<TInterface>) => {
            registrar.useType(implementationType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new TransientLifecycle());
    }

    /**
     * Builds a type-safe service provider from the registered services.
     * 
     * @returns The configured type-safe service provider with full type safety
     * @throws {Error} If the builder has already been built
     * 
     * @example
     * ```typescript
     * const container = new TypeSafeContainerBuilder()
     *   .registerSingleton('Logger', ConsoleLogger)
     *   .buildTypeSafe();
     * 
     * const logger = container.get('Logger'); // Type: ConsoleLogger, IDE autocompletion ✅
     * ```
     */
    buildTypeSafe(): TypeSafeServiceLocator<TRegistry> {
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
    ): TypeSafeContainerBuilder<TRegistry & Record<K, T>> {
        this.ensureNotBuilt();

        const registrar = new TypeSafeRegistrarImpl<T>(key);
        configurator(registrar);
        
        const serviceWrapper = registrar.build(lifecycle);
        this.validateServiceName(key);
        this.registerService(key, serviceWrapper);

        // Return this instance with updated type (cast)
        return this as unknown as TypeSafeContainerBuilder<TRegistry & Record<K, T>>;
    }
}
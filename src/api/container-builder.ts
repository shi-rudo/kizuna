import { TypeSafeRegistrarImpl } from "../core/builders/type-safe-registrar";
import { ScopedLifecycle } from "../core/scopes/scoped";
import { SingletonLifecycle } from "../core/scopes/singleton";
import { TransientLifecycle } from "../core/scopes/transient";
import type { ServiceWrapper } from "../core/services/service-wrapper";
import { BaseContainerBuilder } from "./base-container-builder";
import type {
    Container,
    TypeSafeServiceLocator,
} from "./contracts/interfaces";
import type { AddToRegistry, Factory, ServiceRegistry, TypeSafeRegistrar } from "./contracts/types";
import { ServiceProvider } from "./service-provider";

type IsUnion<T, Whole = T> = T extends Whole
    ? [Whole] extends [T]
        ? false
        : true
    : never;

type IsOpenNumericString<K extends string> = K extends `${infer N extends number}`
    ? number extends N
        ? true
        : false
    : false;

type IsOpenBigintString<K extends string> = K extends `${infer N extends bigint}`
    ? bigint extends N
        ? true
        : false
    : false;

type IsFixedStringLiteral<K extends string> = string extends K
    ? false
    : true extends IsUnion<K>
      ? false
      : IsOpenNumericString<K> extends true
        ? false
        : IsOpenBigintString<K> extends true
          ? false
          : K extends ""
            ? true
            : K extends `${infer _First}${infer Rest}`
              ? IsFixedStringLiteral<Rest>
              : false;

type LiteralServiceKey<K extends string> = IsFixedStringLiteral<K> extends true
    ? K
    : never;

type ServiceConstructor = new (...args: any[]) => any;

/** Extracts up to ten public constructor overloads without runtime work. */
type ConstructorOverloads<TCtor> = TCtor extends {
    new (...args: infer A1): infer R1;
    new (...args: infer A2): infer R2;
    new (...args: infer A3): infer R3;
    new (...args: infer A4): infer R4;
    new (...args: infer A5): infer R5;
    new (...args: infer A6): infer R6;
    new (...args: infer A7): infer R7;
    new (...args: infer A8): infer R8;
    new (...args: infer A9): infer R9;
    new (...args: infer A10): infer R10;
}
    ? | (new (...args: A1) => R1)
      | (new (...args: A2) => R2)
      | (new (...args: A3) => R3)
      | (new (...args: A4) => R4)
      | (new (...args: A5) => R5)
      | (new (...args: A6) => R6)
      | (new (...args: A7) => R7)
      | (new (...args: A8) => R8)
      | (new (...args: A9) => R9)
      | (new (...args: A10) => R10)
    : TCtor;

type ParametersOf<TCtor> = TCtor extends ServiceConstructor
    ? ConstructorParameters<TCtor>
    : never;

type InstanceOf<TCtor> = TCtor extends ServiceConstructor
    ? InstanceType<TCtor>
    : never;

type ConstructorParameterTuples<TCtor extends ServiceConstructor> = ParametersOf<
    ConstructorOverloads<TCtor>
>;

type ConstructedService<TCtor extends ServiceConstructor> = InstanceOf<
    ConstructorOverloads<TCtor>
>;

type MatchingDependencyKey<TRegistry, TParameter> = {
    [K in Extract<keyof TRegistry, string>]: TRegistry[K] extends TParameter
        ? K
        : never;
}[Extract<keyof TRegistry, string>];

type DependencyKeys<
    TRegistry,
    TParameters extends readonly unknown[],
> = {
    [I in keyof TParameters]: MatchingDependencyKey<TRegistry, TParameters[I]>;
};

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
 *   .registerSingletonInterface<IDatabase, 'IDatabase'>('IDatabase', DatabaseService, 'Logger')
 *   .registerScopedInterface<ICache, 'ICache'>('ICache', RedisCache, 'Logger')
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
    /** Creates a root builder with an empty service registry. */
    constructor(..._rootRegistryOnly: keyof TRegistry extends never ? [] : [never]) {
        super();
    }

    // =================
    // CONSTRUCTOR-BASED REGISTRATION
    // =================

    /**
     * Registers a service with singleton lifetime using constructor and dependencies.
     * 
     * @template K - One fixed string key for the service
     * @template TCtor - The service constructor type
     * @param key - One fixed string key that identifies the service
     * @param serviceType - The service constructor
     * @param dependencies - Keys that match the constructor parameters by type and position
     * @returns A new ContainerBuilder with the updated registry type
     * @remarks Register each dependency before you use its key in this method.
     */
    registerSingleton<K extends string, TCtor extends ServiceConstructor>(
        key: LiteralServiceKey<K>,
        serviceType: TCtor,
        ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>
    ): ContainerBuilder<TRegistry & Record<K, ConstructedService<TCtor>>> {
        const configurator = (registrar: TypeSafeRegistrar<ConstructedService<TCtor>>) => {
            registrar.useType(serviceType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new SingletonLifecycle());
    }

    /**
     * Registers a service with scoped lifetime using constructor and dependencies.
     * 
     * @template K - One fixed string key for the service
     * @template TCtor - The service constructor type
     * @param key - One fixed string key that identifies the service
     * @param serviceType - The service constructor
     * @param dependencies - Keys that match the constructor parameters by type and position
     * @returns A new ContainerBuilder with the updated registry type
     * @remarks Register each dependency before you use its key in this method.
     */
    registerScoped<K extends string, TCtor extends ServiceConstructor>(
        key: LiteralServiceKey<K>,
        serviceType: TCtor,
        ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>
    ): ContainerBuilder<TRegistry & Record<K, ConstructedService<TCtor>>> {
        const configurator = (registrar: TypeSafeRegistrar<ConstructedService<TCtor>>) => {
            registrar.useType(serviceType, ...dependencies);
        };
        return this.registerTypeSafe(key, configurator, new ScopedLifecycle());
    }

    /**
     * Registers a service with transient lifetime using constructor and dependencies.
     * 
     * @template K - One fixed string key for the service
     * @template TCtor - The service constructor type
     * @param key - One fixed string key that identifies the service
     * @param serviceType - The service constructor
     * @param dependencies - Keys that match the constructor parameters by type and position
     * @returns A new ContainerBuilder with the updated registry type
     * @remarks Register each dependency before you use its key in this method.
     */
    registerTransient<K extends string, TCtor extends ServiceConstructor>(
        key: LiteralServiceKey<K>,
        serviceType: TCtor,
        ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>
    ): ContainerBuilder<TRegistry & Record<K, ConstructedService<TCtor>>> {
        const configurator = (registrar: TypeSafeRegistrar<ConstructedService<TCtor>>) => {
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
     * @template K - One fixed string key for the service
     * @param key - The string key used to identify the service
     * @param implementationType - The concrete implementation constructor
     * @param dependencies - Optional dependency keys
     * @returns A new ContainerBuilder with the updated registry type
     * @remarks When specifying TInterface explicitly, also specify K as one fixed string literal. Unions and open template-literal types are rejected.
     */
    registerSingletonInterface<TInterface, K extends string>(
        key: LiteralServiceKey<K>,
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
     * @template K - One fixed string key for the service
     * @param key - The string key used to identify the service
     * @param implementationType - The concrete implementation constructor
     * @param dependencies - Optional dependency keys
     * @returns A new ContainerBuilder with the updated registry type
     * @remarks When specifying TInterface explicitly, also specify K as one fixed string literal. Unions and open template-literal types are rejected.
     */
    registerScopedInterface<TInterface, K extends string>(
        key: LiteralServiceKey<K>,
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
     * @template K - One fixed string key for the service
     * @param key - The string key used to identify the service
     * @param implementationType - The concrete implementation constructor
     * @param dependencies - Optional dependency keys
     * @returns A new ContainerBuilder with the updated registry type
     * @remarks When specifying TInterface explicitly, also specify K as one fixed string literal. Unions and open template-literal types are rejected.
     */
    registerTransientInterface<TInterface, K extends string>(
        key: LiteralServiceKey<K>,
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
            registrar.useFactory(factory as Factory<T>);
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
            registrar.useFactory(factory as Factory<T>);
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
            registrar.useFactory(factory as Factory<T>);
        };
        return this.registerTypeSafe(key, configurator, new TransientLifecycle());
    }

    // =================
    // MULTI-REGISTRATION (add* = append semantics)
    // =================

    /**
     * Appends a singleton service under a multi-registration key.
     * Multiple services can be registered under the same key and resolved together via `getAll()`.
     * Cannot be mixed with `register*()` for the same key.
     *
     * @template K - One fixed string key for the multi-registration
     * @template TCtor - The service constructor type
     * @param key - One fixed string key for this group of services
     * @param serviceType - The service constructor
     * @param dependencies - Keys that match the constructor parameters by type and position
     * @returns A new ContainerBuilder with the updated registry type
     * @remarks Register each dependency before you use its key in this method.
     */
    addSingleton<K extends string, TCtor extends ServiceConstructor>(
        key: LiteralServiceKey<K>,
        serviceType: TCtor,
        ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>
    ): ContainerBuilder<AddToRegistry<TRegistry, K, ConstructedService<TCtor>>> {
        return this.addTypeSafe<K, ConstructedService<TCtor>>(
            key,
            serviceType,
            dependencies,
            new SingletonLifecycle(),
        );
    }

    /**
     * Appends a scoped service under a multi-registration key.
     * Multiple services can be registered under the same key and resolved together via `getAll()`.
     * Cannot be mixed with `register*()` for the same key.
     *
     * @template K - One fixed string key for the multi-registration
     * @template TCtor - The service constructor type
     * @param key - One fixed string key for this group of services
     * @param serviceType - The service constructor
     * @param dependencies - Keys that match the constructor parameters by type and position
     * @returns A new ContainerBuilder with the updated registry type
     * @remarks Register each dependency before you use its key in this method.
     */
    addScoped<K extends string, TCtor extends ServiceConstructor>(
        key: LiteralServiceKey<K>,
        serviceType: TCtor,
        ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>
    ): ContainerBuilder<AddToRegistry<TRegistry, K, ConstructedService<TCtor>>> {
        return this.addTypeSafe<K, ConstructedService<TCtor>>(
            key,
            serviceType,
            dependencies,
            new ScopedLifecycle(),
        );
    }

    /**
     * Appends a transient service under a multi-registration key.
     * Multiple services can be registered under the same key and resolved together via `getAll()`.
     * Cannot be mixed with `register*()` for the same key.
     *
     * @template K - One fixed string key for the multi-registration
     * @template TCtor - The service constructor type
     * @param key - One fixed string key for this group of services
     * @param serviceType - The service constructor
     * @param dependencies - Keys that match the constructor parameters by type and position
     * @returns A new ContainerBuilder with the updated registry type
     * @remarks Register each dependency before you use its key in this method.
     */
    addTransient<K extends string, TCtor extends ServiceConstructor>(
        key: LiteralServiceKey<K>,
        serviceType: TCtor,
        ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>
    ): ContainerBuilder<AddToRegistry<TRegistry, K, ConstructedService<TCtor>>> {
        return this.addTypeSafe<K, ConstructedService<TCtor>>(
            key,
            serviceType,
            dependencies,
            new TransientLifecycle(),
        );
    }

    /**
     * Appends a factory-based singleton under a multi-registration key.
     * Multiple services can be registered under the same key and resolved together via `getAll()`.
     * Cannot be mixed with `register*()` for the same key.
     *
     * @template K - The string key for the multi-registration
     * @template T - The service type (inferred from factory return)
     * @param key - The shared key for this group of services
     * @param factory - Factory function that creates the service with type-safe provider access
     * @returns A new ContainerBuilder with the updated registry type
     */
    addSingletonFactory<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
    ): ContainerBuilder<AddToRegistry<TRegistry, K, T>> {
        return this.addFactoryTypeSafe(key, factory, new SingletonLifecycle());
    }

    /**
     * Appends a factory-based scoped service under a multi-registration key.
     * Multiple services can be registered under the same key and resolved together via `getAll()`.
     * Cannot be mixed with `register*()` for the same key.
     *
     * @template K - The string key for the multi-registration
     * @template T - The service type (inferred from factory return)
     * @param key - The shared key for this group of services
     * @param factory - Factory function that creates the service with type-safe provider access
     * @returns A new ContainerBuilder with the updated registry type
     */
    addScopedFactory<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
    ): ContainerBuilder<AddToRegistry<TRegistry, K, T>> {
        return this.addFactoryTypeSafe(key, factory, new ScopedLifecycle());
    }

    /**
     * Appends a factory-based transient service under a multi-registration key.
     * Multiple services can be registered under the same key and resolved together via `getAll()`.
     * Cannot be mixed with `register*()` for the same key.
     *
     * @template K - The string key for the multi-registration
     * @template T - The service type (inferred from factory return)
     * @param key - The shared key for this group of services
     * @param factory - Factory function that creates the service with type-safe provider access
     * @returns A new ContainerBuilder with the updated registry type
     */
    addTransientFactory<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
    ): ContainerBuilder<AddToRegistry<TRegistry, K, T>> {
        return this.addFactoryTypeSafe(key, factory, new TransientLifecycle());
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

        if (this.registrations.size === 0 && this.multiRegistrations.size === 0) {
            this.logWarning("Building ServiceProvider with no registered services");
        }

        const registrationsObject = Object.fromEntries(this.registrations);
        const multiRegistrationsObject: Record<string, ServiceWrapper[]> = {};
        this.multiRegistrations.forEach((wrappers, key) => {
            multiRegistrationsObject[key] = [...wrappers];
        });

        return new ServiceProvider<TRegistry>(registrationsObject, multiRegistrationsObject);
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

    /**
     * Internal helper for constructor-based multi-registration.
     * @private
     */
    private addTypeSafe<K extends string, T>(
        key: K,
        serviceType: new (...args: any[]) => T,
        dependencies: string[],
        lifecycle: Container
    ): ContainerBuilder<AddToRegistry<TRegistry, K, T>> {
        this.ensureNotBuilt();

        const registrar = new TypeSafeRegistrarImpl<T>(key);
        registrar.useType(serviceType, ...dependencies);
        const serviceWrapper = registrar.build(lifecycle);
        this.addMultiService(key, serviceWrapper);

        return this as unknown as ContainerBuilder<AddToRegistry<TRegistry, K, T>>;
    }

    /**
     * Internal helper for factory-based multi-registration.
     * @private
     */
    private addFactoryTypeSafe<K extends string, T>(
        key: K,
        factory: (provider: TypeSafeServiceLocator<TRegistry>) => T,
        lifecycle: Container
    ): ContainerBuilder<AddToRegistry<TRegistry, K, T>> {
        this.ensureNotBuilt();

        const registrar = new TypeSafeRegistrarImpl<T>(key);
        registrar.useFactory(factory as Factory<T>);
        const serviceWrapper = registrar.build(lifecycle);
        this.addMultiService(key, serviceWrapper);

        return this as unknown as ContainerBuilder<AddToRegistry<TRegistry, K, T>>;
    }
}

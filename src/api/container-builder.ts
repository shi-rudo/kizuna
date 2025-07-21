import { ServiceBuilderFactory } from "../core/builders/service-builder-factory";
import { TypeSafeRegistrarImpl } from "../core/builders/type-safe-registrar";
import { ScopedLifecycle } from "../core/scopes/scoped";
import { SingletonLifecycle } from "../core/scopes/singleton";
import { TransientLifecycle } from "../core/scopes/transient";
import type { ServiceWrapper } from "../core/services/service-wrapper";
import type {
    Container,
    ServiceLocator as IServiceLocator,
    TypeSafeServiceLocator,
} from "./contracts/interfaces";
import type { ServiceRegistry, TypeSafeRegistrar } from "./contracts/types";
import { ServiceProvider } from "./service-provider";
import { TypeSafeServiceProvider } from "./type-safe-service-provider";

/**
 * Environment detection utility for cross-platform compatibility.
 * Detects development mode across different JavaScript environments (Node.js, browsers, etc.)
 *
 * @returns {boolean} True if running in development mode, false otherwise
 * @internal
 */
const isDevelopment = (): boolean => {
    try {
        // Check for common development indicators across environments
        return (
            (typeof globalThis !== "undefined" &&
                (globalThis as any).__DEV__ === true) ||
            (typeof process !== "undefined" && process.env?.NODE_ENV !== "production")
        );
    } catch {
        return false;
    }
};

/**
 * Extended interface for service builders with generic type support.
 * This interface ensures that all service builders can create ServiceWrapper instances.
 *
 * @template T - The type of service being built
 * @internal
 */
interface IServiceBuilder<T> {
    /**
     * Builds a service wrapper with the specified lifecycle management.
     *
     * @param lifecycleManager - The lifecycle implementation that manages the service's lifetime
     * @returns A configured ServiceWrapper ready for dependency injection
     */
    build(lifecycleManager: Container): ServiceWrapper;
}

/**
 * Type definition for service builder callback functions.
 * These callbacks are used to configure how services should be instantiated and managed.
 *
 * @template T - The type of service being configured
 * @param builder - The ServiceBuilderFactory used to configure the service
 * @returns A service builder that can create the service with its dependencies
 *
 * @example
 * ```typescript
 * // Configure a service with no dependencies
 * const callback: ServiceBuilderCallback<MyService> = (builder) =>
 *   builder.fromType(MyService);
 *
 * // Configure a service with dependencies
 * const callbackWithDeps: ServiceBuilderCallback<ComplexService> = (builder) =>
 *   builder.fromType(ComplexService).withDependencies(DatabaseService, LoggerService);
 * ```
 */
type ServiceBuilderCallback<T = unknown> = (
    builder: ServiceBuilderFactory,
) => IServiceBuilder<T>;

/**
 * ContainerBuilder is the main entry point for configuring dependency injection services.
 * It provides a fluent API for registering services with different lifecycles and building
 * a fully configured service container.
 *
 * The ContainerBuilder supports three main service lifecycles:
 * - **Singleton**: One instance per application lifetime
 * - **Scoped**: One instance per scope (useful for request-scoped services)
 * - **Transient**: New instance every time the service is requested
 *
 * @template TRegistry - The service registry type tracking registered services
 *
 * @example
 * ```typescript
 * // Basic usage
 * const builder = new ContainerBuilder();
 *
 * // Register services with different lifecycles
 * builder.addSingleton(r => r.fromType(DatabaseService));
 * builder.addScoped(r => r.fromType(UserService).withDependencies(DatabaseService));
 * builder.addTransient(r => r.fromType(Logger));
 *
 * // Build the container
 * const container = builder.build();
 *
 * // Resolve services
 * const userService = container.get(UserService);
 * ```
 *
 * @example
 * ```typescript
 * // Type-safe registration (new API)
 * const builder = new ContainerBuilder()
 *   .registerSingleton("Logger", ConsoleLogger)
 *   .registerScoped("UserService", UserService, "Logger");
 * 
 * const container = builder.buildTypeSafe();
 * const logger = container.get("Logger"); // Type inferred as ConsoleLogger
 * ```
 *
 * @throws {Error} When attempting to modify the builder after it has been built
 * @throws {Error} When registering services with invalid parameters
 * @throws {Error} When circular dependencies are detected during validation
 */
export class ContainerBuilder<TRegistry extends ServiceRegistry = {}> {
    private readonly registrations: Map<string, ServiceWrapper> = new Map();
    private readonly registrationNames: Set<string> = new Set();
    private isBuilt: boolean = false;

    /**
     * Creates a new instance of ContainerBuilder.
     *
     * @param {unknown} [patch] - Optional patch object for configuration.
     *   If provided, the patch object will be processed to configure function names
     *   for better debugging support in development environments.
     *
     * @example
     * ```typescript
     * // Create a basic container builder
     * const builder = new ContainerBuilder();
     *
     * // Create with patch configuration for debugging
     * const builderWithPatch = new ContainerBuilder({
     *   myModule: {
     *     myFunction: () => 'test'
     *   }
     * });
     * ```
     */
    constructor(patch?: unknown) {
        if (patch && typeof patch === "object" && patch !== null) {
            this.patch(patch as Record<string, unknown>);
        }
    }

    /**
     * Registers a service with scoped lifetime (one instance per scope).
     *
     * Scoped services are created once per scope and reused within that scope.
     * This is particularly useful for request-scoped services in web applications
     * where you want to maintain the same instance throughout a single request
     * but create new instances for different requests.
     *
     * @template T - The service type being registered
     * @param {ServiceBuilderCallback<T>} registration - Factory function for service configuration
     * @returns {this} ContainerBuilder for method chaining
     * @throws {Error} If the container builder has already been built
     *
     * @example
     * ```typescript
     * // Register a scoped service with no dependencies
     * builder.addScoped(r => r.fromType(RequestContext));
     *
     * // Register a scoped service with dependencies
     * builder.addScoped(r =>
     *   r.fromType(UserService).withDependencies(DatabaseService, LoggerService)
     * );
     *
     * // Register using interface name
     * builder.addScoped(r =>
     *   r.fromName('IUserRepository').useType(UserRepository)
     * );
     * ```
     */
    addScoped<T>(registration: ServiceBuilderCallback<T>): this {
        return this.add<T>(new ScopedLifecycle(), registration);
    }

    /**
     * Registers a service with transient lifetime (new instance every time).
     *
     * Transient services are created fresh every time they are requested.
     * This is useful for lightweight services that don't maintain state
     * or for services where you need a completely fresh instance each time.
     *
     * @template T - The service type being registered
     * @param {ServiceBuilderCallback<T>} registration - Factory function for service configuration
     * @returns {this} ContainerBuilder for method chaining
     * @throws {Error} If the container builder has already been built
     *
     * @example
     * ```typescript
     * // Register a transient service - new instance every time
     * builder.addTransient(r => r.fromType(Logger));
     *
     * // Register with dependencies
     * builder.addTransient(r =>
     *   r.fromType(EmailService).withDependencies(SmtpClient, TemplateEngine)
     * );
     *
     * // Register using factory function
     * builder.addTransient(r =>
     *   r.fromName('RequestId').useFactory(() => crypto.randomUUID())
     * );
     * ```
     */
    addTransient<T>(registration: ServiceBuilderCallback<T>): this {
        return this.add<T>(new TransientLifecycle(), registration);
    }

    /**
     * Registers a service with singleton lifetime (one instance for application lifetime).
     *
     * Singleton services are created once and reused throughout the entire application lifetime.
     * This is ideal for expensive-to-create services, shared state, or services that coordinate
     * across the entire application (like configuration, logging, or database connections).
     *
     * @template T - The service type being registered
     * @param {ServiceBuilderCallback<T>} registration - Factory function for service configuration
     * @returns {this} ContainerBuilder for method chaining
     * @throws {Error} If the container builder has already been built
     *
     * @example
     * ```typescript
     * // Register a singleton configuration service
     * builder.addSingleton(r => r.fromType(AppConfig));
     *
     * // Register database connection as singleton
     * builder.addSingleton(r =>
     *   r.fromName('DatabaseConnection').useFactory(() => new Database(connectionString))
     * );
     *
     * // Register singleton with dependencies
     * builder.addSingleton(r =>
     *   r.fromType(CacheService).withDependencies(RedisClient, Logger)
     * );
     * ```
     */
    addSingleton<T>(registration: ServiceBuilderCallback<T>): this {
        return this.add<T>(new SingletonLifecycle(), registration);
    }

    /**
     * Registers a service with a custom lifecycle manager.
     *
     * This method allows you to provide your own lifecycle management implementation.
     * Use this when the built-in singleton, scoped, and transient lifecycles don't
     * meet your specific requirements.
     *
     * @template T - The service type being registered
     * @param {Container} lifecycleManager - The lifecycle implementation for the service (must implement Container interface)
     * @param {ServiceBuilderCallback<T>} registration - Factory function for service configuration
     * @returns {this} ContainerBuilder for method chaining
     * @throws {Error} If the container builder has already been built
     * @throws {Error} If lifecycle manager or registration parameters are invalid
     *
     * @example
     * ```typescript
     * // Custom lifecycle implementation
     * class CustomLifecycle implements Container {
     *   // ... custom lifecycle logic
     * }
     *
     * // Register service with custom lifecycle manager
     * builder.add(new CustomLifecycle(), r => r.fromType(SpecialService));
     * ```
     */
    add<T>(lifecycleManager: Container, registration: ServiceBuilderCallback<T>): this {
        this.ensureNotBuilt();

        if (!lifecycleManager) {
            throw new Error("Lifecycle manager parameter is required");
        }

        if (typeof registration !== "function") {
            throw new Error("Registration callback must be a function");
        }

        try {
            const registrationResult = registration(new ServiceBuilderFactory());

            if (!this.isServiceBuilder(registrationResult)) {
                throw new Error(
                    "Registration function must return a valid service builder",
                );
            }

            const componentResolver = registrationResult.build(lifecycleManager);
            const serviceName = componentResolver.getName();

            if (!serviceName) {
                throw new Error("Component registration must have a name");
            }

            this.validateServiceName(serviceName);
            this.registerService(serviceName, componentResolver);

            return this;
        } catch (error) {
            throw new Error(
                `Failed to register service: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Type-safe singleton service registration with constructor and dependencies.
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
     * Type-safe scoped service registration with constructor and dependencies.
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
     * Type-safe transient service registration with constructor and dependencies.
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

    /**
     * Internal method to handle type-safe service registration.
     * 
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
     * Builds a type-safe service provider from the registered services.
     * @returns The configured type-safe service provider
     */
    buildTypeSafe(): TypeSafeServiceLocator<TRegistry> {
        this.ensureNotBuilt();
        this.isBuilt = true;

        if (this.registrations.size === 0) {
            this.logWarning("Building ServiceProvider with no registered services");
        }

        const registrationsObject = Object.fromEntries(this.registrations);
        return new TypeSafeServiceProvider<TRegistry>(registrationsObject);
    }

    /**
     * Checks if a service is registered.
     * @param serviceName The name of the service or constructor function
     * @returns true if the service is registered, false otherwise
     */
    /**
     * Checks if a service is registered.
     * @template T - The service type
     * @param {string | T} serviceName - The name of the service or its constructor
     * @returns {boolean} True if the service is registered, false otherwise
     */
    isRegistered<T extends new (...args: any[]) => any>(
        serviceName: string | T,
    ): boolean {
        const name =
            typeof serviceName === "string" ? serviceName : serviceName.name;
        return this.registrationNames.has(name);
    }

    /**
     * Gets the number of registered services.
     * @returns The count of registered services
     */
    /**
     * Gets the number of registered services.
     * @returns {number} The count of registered services
     */
    get count(): number {
        return this.registrationNames.size;
    }

    /**
     * Gets all registered service names.
     * @returns Array of registered service names
     */
    /**
     * Gets all registered service names.
     * @returns {string[]} Array of registered service names
     */
    getRegisteredServiceNames(): string[] {
        return Array.from(this.registrationNames);
    }

    /**
     * Removes a service registration.
     * @param serviceName The name of the service or constructor function
     * @returns true if the service was removed, false if it wasn't registered
     */
    /**
     * Removes a service registration.
     * @template T - The service type
     * @param {string | T} serviceName - The name of the service or its constructor
     * @returns {boolean} True if the service was removed, false if it wasn't registered
     */
    remove<T extends new (...args: any[]) => any>(
        serviceName: string | T,
    ): boolean {
        this.ensureNotBuilt();

        const name =
            typeof serviceName === "string" ? serviceName : serviceName.name;

        if (!this.registrationNames.has(name)) {
            return false;
        }

        try {
            const resolver = this.registrations.get(name);
            resolver?.dispose?.();

            this.registrations.delete(name);
            this.registrationNames.delete(name);
            return true;
        } catch (error) {
            this.logError(`Error removing service '${name}':`, error);
            return false;
        }
    }

    /**
     * Builds the service provider from the registered services.
     * @returns The configured service provider
     */
    /**
     * Builds the service provider from the registered services.
     * @returns {IServiceLocator} The configured service provider
     * @throws {Error} If the service collection has already been built
     */
    build(): IServiceLocator {
        this.ensureNotBuilt();
        this.isBuilt = true;

        if (this.registrations.size === 0) {
            this.logWarning("Building ServiceProvider with no registered services");
        }

        const registrationsObject = Object.fromEntries(this.registrations);
        return new ServiceProvider(registrationsObject);
    }

    /**
     * Clears all service registrations.
     */
    /**
     * Clears all service registrations.
     * @throws {Error} If the service collection has already been built
     */
    clear(): void {
        this.ensureNotBuilt();

        // Dispose of all resolvers
        this.registrations.forEach((resolver) => {
            try {
                resolver.dispose?.();
            } catch (error) {
                this.logError("Error disposing resolver:", error);
            }
        });

        this.registrations.clear();
        this.registrationNames.clear();
    }

    /**
     * Validates all service registrations for potential issues.
     * @returns Array of validation warnings/errors
     */
    /**
     * Validates all service registrations for potential issues.
     * @returns {string[]} Array of validation warnings/errors
     */
    validate(): string[] {
        const issues: string[] = [];

        // Basic validation of service registrations
        this.registrations.forEach((resolver, name) => {
            if (!name || typeof name !== "string" || name.trim() === "") {
                issues.push("Service registration has empty or invalid name");
                return;
            }

            if (resolver.isDisposed()) {
                issues.push(`Service '${name}' has been disposed`);
                return;
            }

            // Validate dependencies exist
            const dependencies = resolver.getDependencies();
            dependencies.forEach((dep) => {
                if (!this.isRegistered(dep)) {
                    issues.push(
                        `Service '${name}' depends on unregistered service '${dep}'`,
                    );
                }
            });
        });

        // Check for circular dependencies
        const circularDependencies = this.detectCircularDependencies();
        issues.push(...circularDependencies);

        return issues;
    }

    /**
     * Detects circular dependencies in the service registrations.
     * @returns Array of circular dependency error messages
     */
    private detectCircularDependencies(): string[] {
        const issues: string[] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        // Build dependency graph
        const dependencyGraph = new Map<string, string[]>();
        this.registrations.forEach((resolver, name) => {
            dependencyGraph.set(name, [...resolver.getDependencies()]);
        });

        // Depth-first search to detect cycles
        const hasCycle = (serviceName: string, path: string[]): boolean => {
            if (recursionStack.has(serviceName)) {
                // Found a cycle
                const cycleStart = path.indexOf(serviceName);
                const cycle = [...path.slice(cycleStart), serviceName];
                issues.push(`Circular dependency detected: ${cycle.join(" -> ")}`);
                return true;
            }

            if (visited.has(serviceName)) {
                return false; // Already processed this path
            }

            visited.add(serviceName);
            recursionStack.add(serviceName);

            const dependencies = dependencyGraph.get(serviceName) || [];
            for (const dependency of dependencies) {
                if (dependencyGraph.has(dependency)) {
                    if (hasCycle(dependency, [...path, serviceName])) {
                        return true;
                    }
                }
            }

            recursionStack.delete(serviceName);
            return false;
        };

        // Check each service for cycles
        dependencyGraph.forEach((_, serviceName) => {
            if (!visited.has(serviceName)) {
                hasCycle(serviceName, []);
            }
        });

        return issues;
    }

    /**
     * Helper function to check if a value is a plain object
     */
    private isPlainObject(obj: unknown): obj is Record<string, unknown> {
        return (
            obj !== null &&
            typeof obj === "object" &&
            Object.prototype.toString.call(obj) === "[object Object]" &&
            Object.getPrototypeOf(obj) === Object.prototype
        );
    }

    /**
     * Validates a service name.
     * @private
     * @param {string} serviceName - The name to validate
     * @throws {Error} If the service name is invalid
     */
    private validateServiceName(serviceName: string): void {
        if (
            !serviceName ||
            typeof serviceName !== "string" ||
            serviceName.trim() === ""
        ) {
            throw new Error("Service registration must have a valid name");
        }

        if (this.registrationNames.has(serviceName)) {
            this.logWarning(
                `Service '${serviceName}' is already registered. Overwriting existing registration.`,
            );
        }
    }

    /**
     * Registers a service with the given name and resolver.
     * @private
     * @param {string} serviceName - The name of the service
     * @param {ServiceWrapper} resolver - The service wrapper
     */
    private registerService(serviceName: string, resolver: ServiceWrapper): void {
        this.registrations.set(serviceName, resolver);
        this.registrationNames.add(serviceName);
    }

    /**
     * Type guard to check if an object is a valid ServiceBuilder.
     * @private
     */
    private isServiceBuilder<T>(obj: unknown): obj is IServiceBuilder<T> {
        return (
            obj !== null &&
            typeof obj === "object" &&
            "build" in (obj as Record<string, unknown>) &&
            typeof (obj as { build: unknown }).build === "function"
        );
    }

    /**
     * Sets the display name of a function for better debugging.
     * @private
     * @param {Function} fn - The function to name
     * @param {string} name - The name to set
     */
    private setFunctionName(fn: Function, name: string): void {
        if (typeof fn !== "function" || !name) {
            return;
        }

        try {
            // Try to set the display name if the environment supports it
            if ("displayName" in fn) {
                (fn as { displayName?: string }).displayName = name;
            }

            // Set the name property if configurable
            try {
                Object.defineProperty(fn, "name", {
                    value: name,
                    configurable: true,
                });
            } catch (_) {
                // In some environments, the name property might not be configurable
                if (isDevelopment()) {
                    this.logWarning(`Could not set name for function: ${name}`);
                }
            }
        } catch (error) {
            if (isDevelopment()) {
                this.logError(`Error setting function name for ${name}:`, error);
            }
        }
    }

    /**
     * Patches the service collection with functions from the provided namespace.
     * @private
     * @param {Record<string, unknown>} ns - The namespace object to patch from
     * @param {string} [currentPath] - The current path in the namespace (used for recursion)
     */
    private patch(ns: Record<string, unknown>, path: string = ""): void {
        if (!ns || typeof ns !== "object") {
            return;
        }

        try {
            Object.entries(ns).forEach(([key, value]) => {
                const currentPath = path ? `${path}.${key}` : key;

                try {
                    if (this.isPlainObject(value)) {
                        // Recursively patch plain objects
                        this.patch(value as Record<string, unknown>, currentPath);
                    } else if (typeof value === "function") {
                        // Set function name for functions
                        this.setFunctionName(value, currentPath);
                    }
                } catch (error) {
                    if (isDevelopment()) {
                        this.logError(`Error processing '${currentPath}':`, error);
                    }
                }
            });
        } catch (error) {
            if (isDevelopment()) {
                this.logError("Error during patch operation:", error);
            }
        }
    }

    /**
     * Environment-agnostic logging methods
     */
    private logWarning(message: string): void {
        try {
            if (typeof console !== "undefined" && console.warn) {
                console.warn(message);
            }
        } catch {
            // Silently ignore if console is not available
        }
    }

    private logError(message: string, error?: unknown): void {
        try {
            if (typeof console !== "undefined" && console.error) {
                console.error(message, error);
            }
        } catch {
            // Silently ignore if console is not available
        }
    }

    private ensureNotBuilt(): void {
        if (this.isBuilt) {
            throw new Error("Cannot modify ContainerBuilder after it has been built");
        }
    }
}
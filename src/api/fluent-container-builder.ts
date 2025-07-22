import { ServiceBuilderFactory } from "../core/builders/service-builder-factory";
import { ScopedLifecycle } from "../core/scopes/scoped";
import { SingletonLifecycle } from "../core/scopes/singleton";
import { TransientLifecycle } from "../core/scopes/transient";
import { BaseContainerBuilder } from "./base-container-builder";
import type {
    Container,
    ServiceLocator as IServiceLocator,
} from "./contracts/interfaces";
import { ServiceProvider } from "./service-provider";

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
    build(lifecycleManager: Container): import("../core/services/service-wrapper").ServiceWrapper;
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
 * FluentContainerBuilder provides a flexible, runtime-focused API for configuring dependency injection services.
 * It offers maximum flexibility through factory functions, custom lifecycle managers, and dynamic registration patterns.
 *
 * The FluentContainerBuilder supports:
 * - **Runtime flexibility**: Register services using factory functions and dynamic patterns
 * - **Custom lifecycles**: Provide your own lifecycle management implementations
 * - **Interface-based registration**: Register services by interface names using `fromName()`
 * - **Complex dependencies**: Handle advanced dependency scenarios with full control
 *
 * @example
 * ```typescript
 * // Basic fluent registration
 * const container = new FluentContainerBuilder()
 *   .addSingleton(r => r.fromType(DatabaseService))
 *   .addScoped(r => r.fromType(UserService).withDependencies(DatabaseService))
 *   .build();
 * 
 * const userService = container.get(UserService);
 * ```
 *
 * @example
 * ```typescript
 * // Interface-based registration
 * const container = new FluentContainerBuilder()
 *   .addSingleton(r => r.fromName('ILogger').useType(ConsoleLogger))
 *   .addScoped(r => r.fromName('IUserRepository').useFactory(() => new DatabaseUserRepository()))
 *   .build();
 * 
 * const logger = container.get<ILogger>('ILogger');
 * ```
 *
 * @example
 * ```typescript
 * // Custom lifecycle
 * class CustomLifecycle implements Container {
 *   // Custom lifecycle implementation
 * }
 * 
 * const container = new FluentContainerBuilder()
 *   .add(new CustomLifecycle(), r => r.fromType(SpecialService))
 *   .build();
 * ```
 */
export class FluentContainerBuilder extends BaseContainerBuilder {
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
     * @returns {this} FluentContainerBuilder for method chaining
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
     * @returns {this} FluentContainerBuilder for method chaining
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
     * @returns {this} FluentContainerBuilder for method chaining
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
     * @returns {this} FluentContainerBuilder for method chaining
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
     * Builds the service provider from the registered services.
     * 
     * @returns {IServiceLocator} The configured service provider
     * @throws {Error} If the service collection has already been built
     * 
     * @example
     * ```typescript
     * const container = new FluentContainerBuilder()
     *   .addSingleton(r => r.fromType(Logger))
     *   .build();
     * 
     * const logger = container.get(Logger);
     * ```
     */
    build(): IServiceLocator {
        this.ensureNotBuilt();
        this.markAsBuilt();

        if (this.registrations.size === 0) {
            this.logWarning("Building ServiceProvider with no registered services");
        }

        const registrationsObject = Object.fromEntries(this.registrations);
        return new ServiceProvider(registrationsObject);
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
}
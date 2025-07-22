/**
 * Kizuna Dependency Injection Library
 *
 * A lightweight, type-safe dependency injection container for TypeScript/JavaScript applications.
 * Supports singleton, scoped, and transient service lifecycles with automatic dependency resolution.
 * 
 * Provides two distinct APIs:
 * - **TypeSafeContainerBuilder**: Compile-time type safety and IDE autocompletion
 * - **FluentContainerBuilder**: Runtime flexibility and dynamic registration patterns
 *
 * @example
 * ```typescript
 * import { TypeSafeContainerBuilder } from '@shirudo/kizuna';
 *
 * // Type-safe API - Full compile-time checking
 * const container = new TypeSafeContainerBuilder()
 *   .registerSingleton('Logger', ConsoleLogger)
 *   .registerScoped('UserService', UserService, 'Logger')
 *   .buildTypeSafe();
 *
 * const userService = container.get('UserService'); // Type: UserService ✅
 * ```
 *
 * @example
 * ```typescript
 * import { FluentContainerBuilder } from '@shirudo/kizuna';
 *
 * // Fluent API - Runtime flexibility
 * const container = new FluentContainerBuilder()
 *   .addSingleton(r => r.fromType(DatabaseService))
 *   .addScoped(r => r.fromType(UserService).withDependencies(DatabaseService))
 *   .build();
 *
 * const userService = container.get(UserService); // Runtime resolution
 * ```
 *
 * @packageDocumentation
 */

// Container builders - choose the API that fits your needs
export { TypeSafeContainerBuilder } from "./type-safe-container-builder";
export { FluentContainerBuilder } from "./fluent-container-builder";

// Type-safe service provider
export { TypeSafeServiceProvider } from "./type-safe-service-provider";

// Contracts and interfaces
export {
    Container,
    PendingService,
    ServiceBuilder,
    ServiceLocator,
    ServiceRegistration,
    TypeSafeServiceLocator,
} from "./contracts/interfaces";

// Type definitions
export * from "./contracts/types";

// Core services
export { ServiceProvider } from "./service-provider";

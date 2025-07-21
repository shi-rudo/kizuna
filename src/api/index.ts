/**
 * Kizuna Dependency Injection Library
 *
 * A lightweight, type-safe dependency injection container for TypeScript/JavaScript applications.
 * Supports singleton, scoped, and transient service lifecycles with automatic dependency resolution.
 *
 * @example
 * ```typescript
 * import { ContainerBuilder } from '@shirudo/kizuna';
 *
 * // Build your container
 * const builder = new ContainerBuilder();
 * builder.addSingleton(r => r.fromType(DatabaseService));
 * builder.addScoped(r => r.fromType(UserService).withDependencies(DatabaseService));
 *
 * const container = builder.build();
 *
 * // Resolve services
 * const userService = container.get(UserService);
 * ```
 *
 * @packageDocumentation
 */

// Core container building and service resolution
export * from "./container-builder";

<<<<<<< HEAD
=======
// Type-safe service provider
export { TypeSafeServiceProvider } from "./type-safe-service-provider";

>>>>>>> 90d0f39 (Initial commit with type safety changes)
// Contracts and interfaces
export {
    Container,
    PendingService,
    ServiceBuilder,
    ServiceLocator,
    ServiceRegistration,
<<<<<<< HEAD
=======
    TypeSafeServiceLocator,
>>>>>>> 90d0f39 (Initial commit with type safety changes)
} from "./contracts/interfaces";

// Type definitions
export * from "./contracts/types";

// Core services
export { ServiceProvider } from "./service-provider";

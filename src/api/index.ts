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

// Contracts and interfaces
export {
    Container,
    PendingService,
    ServiceBuilder,
    ServiceLocator,
    ServiceRegistration,
} from "./contracts/interfaces";

// Type definitions
export * from "./contracts/types";

// Core services
export { ServiceProvider } from "./service-provider";

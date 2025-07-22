/**
 * Kizuna Dependency Injection Library
 *
 * A lightweight, type-safe dependency injection container for TypeScript/JavaScript applications.
 * Supports singleton, scoped, and transient service lifecycles with automatic dependency resolution.
 * 
 * Features the unified ContainerBuilder with complete type safety and all registration patterns.
 *
 * @example
 * ```typescript
 * import { ContainerBuilder } from '@shirudo/kizuna';
 *
 * // The ultimate type-safe container - all patterns in one!
 * const container = new ContainerBuilder()
 *   // Constructor-based
 *   .registerSingleton('Logger', ConsoleLogger)
 *   .registerScoped('UserService', UserService, 'Logger')
 *   
 *   // Interface-based
 *   .registerSingletonInterface<IDatabase>('IDatabase', DatabaseService, 'Logger')
 *   
 *   // Factory-based
 *   .registerFactory('Config', (provider) => {
 *     const logger = provider.get('Logger'); // Type: ConsoleLogger
 *     return { env: 'production', debug: false };
 *   })
 *   .build();
 *
 * const userService = container.get('UserService'); // Type: UserService ✅
 * const database = container.get('IDatabase');     // Type: IDatabase ✅  
 * const config = container.get('Config');          // Type: { env: string; debug: boolean } ✅
 * ```
 *
 * @packageDocumentation
 */

// The unified, fully type-safe container builder
export { ContainerBuilder } from "./container-builder";

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

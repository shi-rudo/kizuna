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
 * import { ContainerBuilder, interfaceToken } from '@shirudo/kizuna';
 *
 * const Database = interfaceToken<IDatabase>()('IDatabase');
 *
 * // The ultimate type-safe container - all patterns in one!
 * const container = new ContainerBuilder()
 *   // Constructor-based
 *   .registerSingleton('Logger', ConsoleLogger)
 *   .registerScoped('UserService', UserService, 'Logger')
 *
 *   // Interface-based
 *   .registerSingletonInterface(Database, DatabaseService, 'Logger')
 *
 *   // Factory-based
 *   .registerSingletonFactory('Config', (provider) => {
 *     const logger = provider.get('Logger'); // Type: ConsoleLogger
 *     return { env: 'production', debug: false };
 *   })
 *   .build();
 *
 * const userService = container.get('UserService'); // Type: UserService ✅
 * const database = container.get(Database);        // Type: IDatabase ✅
 * const config = container.get('Config');          // Type: { env: string; debug: boolean } ✅
 * ```
 *
 * @packageDocumentation
 */

export { ContainerBuilder } from "./container-builder";
export type { TypeSafeServiceLocator } from "./contracts/interfaces";
export type { InterfaceToken } from "./interface-token";
export { interfaceToken } from "./interface-token";
export {
	CircularDependencyError,
	DisposalError,
	ServiceProviderToken,
} from "./service-provider";

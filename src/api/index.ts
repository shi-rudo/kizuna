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
 *   .registerSingletonFactory('Config', (container) => {
 *     const logger = container.get('Logger'); // Type: ConsoleLogger
 *     return { env: 'production', debug: false };
 *   }, 'Logger')
 *   .build();
 *
 * const userService = container.get('UserService'); // Type: UserService ✅
 * const database = container.get(Database);        // Type: IDatabase ✅
 * const config = container.get('Config');          // Type: { env: string; debug: boolean } ✅
 * ```
 *
 * @packageDocumentation
 */

export type { DisposalFailure, DisposalOperation } from "./container.js";
export {
	CircularDependencyError,
	DisposalError,
	ServiceContainerToken,
	ServiceProviderToken,
} from "./container.js";
export { ContainerBuilder } from "./container-builder.js";
export type {
	RootServiceContainer,
	ServiceContainer,
	TypeSafeServiceLocator,
} from "./contracts/interfaces.js";
export type { MultiRegistration } from "./contracts/types.js";
export type { InterfaceToken } from "./interface-token.js";
export { interfaceToken } from "./interface-token.js";
export type {
	ContainerBuildOptions,
	ValidationIssue,
	ValidationIssueCode,
	ValidationPathSegment,
} from "./validation.js";
export { ContainerValidationError } from "./validation.js";

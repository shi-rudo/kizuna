import type { ServiceLocator } from './interfaces';

/**
 * Constructor type that preserves the exact signature of a constructor function.
 * 
 * This utility type extracts and preserves the parameter types and return type
 * of a constructor function, ensuring type safety when working with service
 * registration and dependency injection.
 * 
 * @template T - The constructor function type to preserve
 * 
 * @example
 * ```typescript
 * class UserService {
 *   constructor(db: DatabaseService, logger: Logger) {}
 * }
 * 
 * // Constructor<typeof UserService> preserves the exact constructor signature
 * type UserServiceConstructor = Constructor<typeof UserService>;
 * // Equivalent to: new (db: DatabaseService, logger: Logger) => UserService
 * ```
 */
export type Constructor<T extends new (...args: any) => any> = T extends new (...args: infer A) => infer R ? new (...args: A) => R : never;

/**
 * Factory function type for creating service instances.
 * 
 * Factory functions receive the ServiceLocator as a parameter, allowing them
 * to resolve dependencies and create complex service instances. This is useful
 * for services that require custom initialization logic or conditional creation.
 * 
 * @template T - The type of service the factory creates
 * @param serviceProvider - The ServiceLocator for resolving dependencies
 * @returns An instance of type T
 * 
 * @example
 * ```typescript
 * // Simple factory
 * const configFactory: Factory<AppConfig> = () => new AppConfig();
 * 
 * // Factory with dependencies
 * const userServiceFactory: Factory<UserService> = (provider) => {
 *   const db = provider.get(DatabaseService);
 *   const logger = provider.get<ILogger>('Logger');
 *   return new UserService(db, logger);
 * };
 * 
 * // Conditional factory
 * const apiClientFactory: Factory<ApiClient> = (provider) => {
 *   const config = provider.get(AppConfig);
 *   return config.isDevelopment 
 *     ? new MockApiClient() 
 *     : new ApiClient(config.apiUrl);
 * };
 * ```
 */
export type Factory<T> = (serviceProvider: ServiceLocator) => T;

/**
 * Union type for service identification keys.
 * 
 * Services can be identified either by a string name (useful for interfaces
 * and abstract types) or by their constructor function (useful for concrete types).
 * This type provides flexibility in how services are registered and resolved.
 * 
 * @template T - The type of service (defaults to any)
 * 
 * @example
 * ```typescript
 * // String-based service keys
 * const loggerKey: ServiceKey<ILogger> = 'Logger';
 * const apiKey: ServiceKey<IApiClient> = 'ApiClient';
 * 
 * // Constructor-based service keys
 * const userServiceKey: ServiceKey<UserService> = UserService;
 * const dbServiceKey: ServiceKey<DatabaseService> = DatabaseService;
 * 
 * // Usage in service resolution
 * const logger = provider.get<ILogger>('Logger');        // string key
 * const userService = provider.get(UserService);         // constructor key
 * ```
 * 
 * @example
 * ```typescript
 * // Type-safe service registration
 * function registerService<T>(key: ServiceKey<T>, factory: Factory<T>) {
 *   // Register service with either string or constructor key
 * }
 * 
 * registerService('Logger', () => new ConsoleLogger());
 * registerService(UserService, (provider) => new UserService(provider.get(DatabaseService)));
 * ```
 */
export type ServiceKey<T = any> = string | (new (...args: any[]) => T);


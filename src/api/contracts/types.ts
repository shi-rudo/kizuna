import type { TypeSafeServiceLocator } from "./interfaces";

/**
 * Factory function type for creating service instances.
 *
 * Factory functions receive the typed service locator as a parameter, allowing them
 * to resolve dependencies and create complex service instances. This is useful
 * for services that require custom initialization logic or conditional creation.
 *
 * The container calls each factory synchronously. If a factory returns a Promise,
 * the container stores and returns that Promise. Each consumer must await it.
 *
 * Singleton and scoped lifecycles own their stored Promise. Their `disposeAsync()`
 * method waits for the Promise and cleans the resolved value. Transient values
 * are not tracked or cleaned.
 *
 * An active singleton or scoped lifecycle removes a rejected Promise from its
 * cache. The next resolution request invokes the factory again. The lifecycle
 * does not retry automatically.
 *
 * @template TRegistry - The registry available when the factory is registered
 * @template T - The type of service the factory creates
 * @param serviceProvider - The typed service locator for resolving dependencies
 * @returns An instance of type T
 *
 * @internal This helper supports the builder implementation. It is not part of
 * the package-root API. Consumers should let registration methods infer it.
 */
export type Factory<TRegistry extends ServiceRegistry, T> = (
	serviceProvider: TypeSafeServiceLocator<TRegistry>,
) => T;

/**
 * Represents a service registry mapping string keys to their service types.
 * This is used internally to track registered services at the type level.
 * @internal
 *
 */
export type ServiceRegistry = Record<string, any>;

/**
 * Utility type that adds a service to the registry under a multi-registration key.
 *
 * - If K is new, creates `Record<K, T[]>` (new multi-key).
 * - If K already exists and holds an array type, widens the union: `(U | T)[]`.
 * - If K already exists but is NOT an array (single-registration collision), resolves to `never`
 *   which produces a compile-time error.
 *
 * @template TRegistry - The current service registry
 * @template K - The string key for the service
 * @template T - The service type being added
 */
export type AddToRegistry<
	TRegistry,
	K extends string,
	T,
> = K extends keyof TRegistry
	? TRegistry[K] extends (infer U)[]
		? Omit<TRegistry, K> & Record<K, (U | T)[]>
		: never
	: TRegistry & Record<K, T[]>;

/**
 * Type-safe registrar interface that provides simplified registration methods.
 * This replaces the complex ServiceBuilderFactory for the new type-safe API.
 *
 * @template TRegistry - The current service registry
 * @template T - The service type being registered
 * @internal
 */
export interface TypeSafeRegistrar<TRegistry extends ServiceRegistry, T> {
	/**
	 * Use a constructor function to create the service.
	 * @param constructor - The constructor function
	 * @param dependencies - Optional dependency keys
	 */
	useType<TCtor extends new (...args: any[]) => T>(
		constructorType: TCtor,
		...dependencies: string[]
	): void;

	/**
	 * Use a factory function to create the service.
	 * @param factory - Factory function that creates the service
	 */
	useFactory(factory: Factory<TRegistry, T>): void;
}

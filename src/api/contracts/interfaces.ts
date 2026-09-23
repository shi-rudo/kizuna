import type { ServiceContainerToken } from "../container.js";
import type {
	InterfaceToken,
	InterfaceTokenService,
	RegisteredInterfaceToken,
} from "../interface-token.js";
import type {
	MultiRegistrationKey,
	MultiRegistrationService,
	SingleRegistrationKey,
} from "./types.js";

/**
 * Resolves registered services. The root container and every scope implement
 * this interface, and factories receive it as their parameter.
 *
 * @template TRegistry - The service registry type mapping string keys to service types
 */
export interface ServiceContainer<TRegistry extends Record<string, any>> {
	/** Resolves a registered interface through its type-safe token. */
	get<TToken extends InterfaceToken<unknown, string>>(
		token: RegisteredInterfaceToken<TRegistry, TToken>,
	): InterfaceTokenService<TToken>;

	/**
	 * Resolves the service of a key with one registration.
	 * Use `getAll()` for a key with multiple registrations.
	 *
	 * @template K - A single-registration key from the registry
	 * @param key - The string key identifying the service (must be registered)
	 * @returns An instance of the service with inferred type
	 * @throws {Error} If the key has multiple registrations
	 */
	get<K extends SingleRegistrationKey<TRegistry>>(
		key: K extends InterfaceToken<unknown, string> ? never : K,
	): TRegistry[K];

	/**
	 * Returns the current container or scope through its identity token.
	 * Constructor values are not service keys.
	 */
	get(token: typeof ServiceContainerToken): ServiceContainer<TRegistry>;

	/**
	 * Resolves all services of a key with multiple registrations, in
	 * registration order. Use `get()` for a key with one registration.
	 *
	 * @template K - A multi-registration key from the registry
	 * @param key - The string key that the `add*()` methods registered
	 * @returns An array of service instances
	 * @throws {Error} If the key has one registration
	 */
	getAll<K extends string & MultiRegistrationKey<TRegistry>>(
		key: K extends InterfaceToken<unknown, string> ? never : K,
	): MultiRegistrationService<TRegistry[K]>[];

	/**
	 * Creates a new scope with the same type safety.
	 *
	 * @returns A new scope with the same registry
	 */
	startScope(): ServiceContainer<TRegistry>;

	/**
	 * Disposes of all services and cleans up resources.
	 *
	 * The container invokes consumer cleanup before dependency cleanup.
	 * It attempts all cleanup operations and then throws one `DisposalError`
	 * with the original failures. It does not write cleanup errors to the
	 * console. If cleanup needs a Promise, this method starts cleanup but cannot
	 * wait. The `DisposalError` contains a `TypeError`. Use `disposeAsync()` for
	 * asynchronous cleanup.
	 */
	dispose(): void;

	/**
	 * Asynchronously disposes of all services and awaits any returned Promises.
	 *
	 * Services can implement `[Symbol.asyncDispose]` or return a Promise from
	 * `dispose()`. This method also waits for stored Promise values and cleans
	 * their resolved values. The container cleans consumers before dependencies.
	 * Independent handlers run in parallel. One rejection does not stop other
	 * cleanup. This method then rejects with one `DisposalError`.
	 */
	disposeAsync(): Promise<void>;

	/**
	 * TC39 explicit-resource-management hook for the `using` syntax.
	 * Equivalent to `dispose()`.
	 */
	[Symbol.dispose](): void;

	/**
	 * TC39 explicit-resource-management hook for the `await using` syntax.
	 * Equivalent to `disposeAsync()`.
	 */
	[Symbol.asyncDispose](): Promise<void>;
}

/**
 * A root container that owns its local singleton registrations.
 *
 * `ContainerBuilder.build()` returns this type. `startScope()` returns a
 * `ServiceContainer` scope that cannot lend singleton registrations.
 */
export interface RootServiceContainer<TRegistry extends Record<string, any>>
	extends ServiceContainer<TRegistry> {
	readonly [Symbol.toStringTag]: "KizunaRootServiceContainer";
}

/**
 * @deprecated Use {@link ServiceContainer}. This alias will be removed in a
 * future major version.
 */
export type TypeSafeServiceLocator<TRegistry extends Record<string, any>> =
	ServiceContainer<TRegistry>;

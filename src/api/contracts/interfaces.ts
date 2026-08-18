import type {
	InterfaceToken,
	InterfaceTokenService,
	RegisteredInterfaceToken,
} from "../interface-token";
import type { ServiceProviderToken } from "../service-provider";

/**
 * Type-safe ServiceLocator that provides compile-time safety and IDE autocompletion.
 *
 * @template TRegistry - The service registry type mapping string keys to service types
 */
export interface TypeSafeServiceLocator<TRegistry extends Record<string, any>> {
	/** Resolves a registered interface through its type-safe token. */
	get<TToken extends InterfaceToken<unknown, string>>(
		token: RegisteredInterfaceToken<TRegistry, TToken>,
	): InterfaceTokenService<TToken>;

	/**
	 * Type-safe service resolution by string key with autocompletion and type inference.
	 *
	 * @template K - The string key from the registry
	 * @param key - The string key identifying the service (must be registered)
	 * @returns An instance of the service with inferred type
	 */
	get<K extends keyof TRegistry>(
		key: K extends InterfaceToken<unknown, string> ? never : K,
	): TRegistry[K];

	/**
	 * Returns the current provider through its explicit infrastructure token.
	 * Constructor values are not service keys.
	 */
	get(token: typeof ServiceProviderToken): TypeSafeServiceLocator<TRegistry>;

	/**
	 * Resolves all implementations registered under a key as an array.
	 * For multi-registration keys, returns the array of all implementations.
	 * For single-registration keys, wraps the result in a single-element array.
	 *
	 * @template K - The string key from the registry
	 * @param key - The string key identifying the services
	 * @returns An array of service instances
	 */
	getAll<TToken extends InterfaceToken<unknown, string>>(
		token: RegisteredInterfaceToken<TRegistry, TToken>,
	): InterfaceTokenService<TToken> extends (infer U)[]
		? U[]
		: InterfaceTokenService<TToken>[];
	getAll<K extends string & keyof TRegistry>(
		key: K extends InterfaceToken<unknown, string> ? never : K,
	): TRegistry[K] extends (infer U)[] ? U[] : TRegistry[K][];

	/**
	 * Creates a new scope with the same type safety.
	 *
	 * @returns A new TypeSafeServiceLocator instance with the same registry
	 */
	startScope(): TypeSafeServiceLocator<TRegistry>;

	/**
	 * Disposes of all services and cleans up resources.
	 *
	 * The provider invokes consumer cleanup before dependency cleanup.
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
	 * their resolved values. The provider cleans consumers before dependencies.
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

import type { LiteralServiceKey } from "./literal-service-key";

declare const interfaceTokenBrand: unique symbol;

/** A string service key that carries its interface type. */
export type InterfaceToken<TInterface, K extends string> = K & {
	readonly [interfaceTokenBrand]: {
		readonly key: K;
		readonly service: TInterface;
	};
};

/** Extracts the service type from an interface token. */
export type InterfaceTokenService<TToken> = TToken extends {
	readonly [interfaceTokenBrand]: { readonly service: infer TInterface };
}
	? TInterface
	: never;

/** Extracts the string key from an interface token. */
export type InterfaceTokenKey<TToken> = TToken extends {
	readonly [interfaceTokenBrand]: { readonly key: infer K extends string };
}
	? K
	: never;

type IsSameType<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
			? true
			: false
		: false;

/** Accepts a token only when its exact service type is registered under its key. */
export type RegisteredInterfaceToken<TRegistry, TToken> = TToken &
	(InterfaceTokenKey<TToken> extends infer K extends keyof TRegistry
		? IsSameType<TRegistry[K], InterfaceTokenService<TToken>> extends true
			? unknown
			: never
		: never);

/** Creates a type-safe interface token with one fixed string key. */
export function interfaceToken<TInterface>() {
	return <const K extends string>(
		key: LiteralServiceKey<K>,
	): InterfaceToken<TInterface, K> =>
		key as unknown as InterfaceToken<TInterface, K>;
}

type IsUnion<T, Whole = T> = T extends Whole
	? [Whole] extends [T]
		? false
		: true
	: never;

type IsOpenNumericString<K extends string> =
	K extends `${infer N extends number}`
		? number extends N
			? true
			: false
		: false;

type IsOpenBigintString<K extends string> =
	K extends `${infer N extends bigint}`
		? bigint extends N
			? true
			: false
		: false;

type IsFixedStringLiteral<K extends string> = string extends K
	? false
	: true extends IsUnion<K>
		? false
		: IsOpenNumericString<K> extends true
			? false
			: IsOpenBigintString<K> extends true
				? false
				: K extends ""
					? true
					: K extends `${infer _First}${infer Rest}`
						? IsFixedStringLiteral<Rest>
						: false;

/** Keeps one fixed string literal and rejects broad or multi-value key types. */
export type LiteralServiceKey<K extends string> =
	IsFixedStringLiteral<K> extends true ? K : never;

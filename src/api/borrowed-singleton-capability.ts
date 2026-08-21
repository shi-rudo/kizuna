import type { BorrowedSingletonReference } from "../core/contracts.js";

/** Shared protocol key for compatible Kizuna bundles in one JavaScript realm. */
export const borrowableSourceCapability: unique symbol = Symbol.for(
	"@shirudo/kizuna.borrowable-source.v1",
);

/** Internal protocol that a compatible root container implements. */
export interface BorrowableSingletonSource {
	[borrowableSourceCapability](key: string): BorrowedSingletonReference;
}

export type { BorrowedSingletonReference } from "../core/contracts.js";

export function isBorrowedSingletonReference(
	value: unknown,
): value is BorrowedSingletonReference {
	return (
		(typeof value === "object" || typeof value === "function") &&
		value !== null &&
		typeof (value as Partial<BorrowedSingletonReference>).resolve === "function"
	);
}

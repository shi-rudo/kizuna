import type { ObservedFactoryValue } from "../../api/contracts/types.js";

/**
 * Returns a Promise-like service value that runs a callback before it rejects.
 *
 * Reads `then` once and invokes it asynchronously. Non-Promise values remain
 * unchanged.
 *
 * @internal
 */
export function observePromiseRejection<T>(
	value: T,
	onRejected: () => void,
): ObservedFactoryValue<T> {
	if (
		value === null ||
		(typeof value !== "object" && typeof value !== "function")
	) {
		return value as ObservedFactoryValue<T>;
	}

	let then: unknown;
	try {
		then = Reflect.get(value, "then");
	} catch {
		return value as ObservedFactoryValue<T>;
	}
	if (typeof then !== "function") {
		return value as ObservedFactoryValue<T>;
	}

	const observedPromise = new Promise<Awaited<T>>((resolve, reject) => {
		queueMicrotask(() => {
			try {
				Reflect.apply(then, value, [resolve, reject]);
			} catch (error) {
				reject(error);
			}
		});
	});

	return observedPromise.catch((error: unknown) => {
		onRejected();
		throw error;
	}) as ObservedFactoryValue<T>;
}

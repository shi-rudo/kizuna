/**
 * Returns a Promise-like service value that runs a callback before it rejects.
 *
 * Non-Promise values remain unchanged.
 *
 * @internal
 */
export function observePromiseRejection<T>(
	value: T,
	onRejected: () => void,
): T {
	if (
		value === null ||
		(typeof value !== "object" && typeof value !== "function")
	) {
		return value;
	}

	let then: unknown;
	try {
		then = Reflect.get(value, "then");
	} catch {
		return value;
	}
	if (typeof then !== "function") {
		return value;
	}

	return Promise.resolve(value).catch((error: unknown) => {
		onRejected();
		throw error;
	}) as T;
}

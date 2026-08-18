/**
 * Runs a callback when a Promise-like service value rejects.
 *
 * The original value remains unchanged and stays available to the consumer.
 *
 * @internal
 */
export function observePromiseRejection(
	value: unknown,
	onRejected: () => void,
): void {
	if (
		value === null ||
		(typeof value !== "object" && typeof value !== "function") ||
		typeof (value as PromiseLike<unknown>).then !== "function"
	) {
		return;
	}

	void Promise.resolve(value).catch(() => onRejected());
}

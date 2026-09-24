/**
 * Invokes a service instance's synchronous dispose hook if present.
 *
 * Prefers `[Symbol.dispose]` (TC39 explicit-resource-management) over a plain
 * `dispose()` method over `[Symbol.asyncDispose]` (last resort — invoked
 * fire-and-forget since a sync path cannot await it). Exactly one hook is
 * invoked.
 *
 * If the instance is a Promise, this function starts cleanup for its resolved
 * value. The caller must report that it cannot wait for this cleanup.
 *
 * Returns the hook's result so callers can attach a rejection handler when a
 * Promise is returned. Errors are propagated; callers decide whether to
 * swallow or log them.
 *
 * @internal
 */
export function invokeSyncDispose(instance: unknown): unknown {
	if (
		instance === null ||
		(typeof instance !== "object" && typeof instance !== "function")
	) {
		return undefined;
	}

	if (isPromiseLike(instance)) {
		return Promise.resolve(instance).then((resolved) =>
			invokeSyncDispose(resolved),
		);
	}

	const obj = instance as Record<PropertyKey, unknown>;

	const syncDisposeSymbolFn = obj[Symbol.dispose];
	if (typeof syncDisposeSymbolFn === "function") {
		return (syncDisposeSymbolFn as () => unknown).call(instance);
	}

	const disposeFn = obj.dispose;
	if (typeof disposeFn === "function") {
		return (disposeFn as () => unknown).call(instance);
	}

	const asyncDisposeFn = obj[Symbol.asyncDispose];
	if (typeof asyncDisposeFn === "function") {
		return (asyncDisposeFn as () => unknown).call(instance);
	}

	return undefined;
}

/** Receives the failure of a cleanup that no caller waits for. @internal */
export type UnawaitedFailureSink = (error: unknown) => void;

/** Drops an unawaited cleanup failure. @internal */
export const ignoreUnawaitedFailure: UnawaitedFailureSink = () => undefined;

/**
 * Lets an asynchronous cleanup result run without waiting for it. Its
 * rejection goes to `onRejected`, so it never becomes an unhandled rejection.
 *
 * @returns True if the result was asynchronous
 * @internal
 */
function continueWithoutWaiting(
	result: unknown,
	onRejected: UnawaitedFailureSink,
): boolean {
	if (isPromiseLike(result)) {
		void Promise.resolve(result).catch(onRejected);
		return true;
	}
	return false;
}

/**
 * Reports cleanup that a synchronous disposal call cannot wait for.
 *
 * The caller receives a synchronous error and can use `disposeAsync()` for
 * future containers. A later rejection of that cleanup goes to `onRejected`.
 *
 * @internal
 */
export function requireSynchronousDispose(
	result: unknown,
	onRejected: UnawaitedFailureSink,
): void {
	if (continueWithoutWaiting(result, onRejected)) {
		throw new TypeError(
			"dispose() started asynchronous cleanup but cannot wait for it. Use disposeAsync() instead of dispose() for containers with asynchronous cleanup.",
		);
	}
}

/**
 * Invokes a service instance's async dispose hook if present.
 *
 * This function waits if the instance is a Promise. It then cleans the
 * resolved value. It prefers `[Symbol.asyncDispose]` over `[Symbol.dispose]`
 * and `dispose()`.
 *
 * Errors propagate to the caller.
 *
 * @internal
 */
export async function invokeAsyncDispose(instance: unknown): Promise<void> {
	if (
		instance === null ||
		(typeof instance !== "object" && typeof instance !== "function")
	) {
		return;
	}

	if (isPromiseLike(instance)) {
		await invokeAsyncDispose(await instance);
		return;
	}

	const obj = instance as Record<PropertyKey, unknown>;

	const asyncDisposeFn = obj[Symbol.asyncDispose];
	if (typeof asyncDisposeFn === "function") {
		await (asyncDisposeFn as () => unknown).call(instance);
		return;
	}

	const syncDisposeSymbolFn = obj[Symbol.dispose];
	if (typeof syncDisposeSymbolFn === "function") {
		const result = (syncDisposeSymbolFn as () => unknown).call(instance);
		if (isPromiseLike(result)) {
			await result;
		}
		return;
	}

	const disposeFn = obj.dispose;
	if (typeof disposeFn === "function") {
		const result = (disposeFn as () => unknown).call(instance);
		if (isPromiseLike(result)) {
			await result;
		}
	}
}

/**
 * Returns true for a value with a callable `then`. A `then` getter that throws
 * makes the value a plain value, as in `observePromiseRejection()`.
 *
 * @internal
 */
export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	if (
		value === null ||
		(typeof value !== "object" && typeof value !== "function")
	) {
		return false;
	}
	try {
		return typeof (value as PromiseLike<unknown>).then === "function";
	} catch {
		return false;
	}
}

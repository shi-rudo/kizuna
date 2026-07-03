/**
 * Invokes a service instance's async dispose hook if present.
 *
 * Prefers `[Symbol.asyncDispose]` (TC39 explicit-resource-management) over
 * `[Symbol.dispose]` over a plain `dispose()` method. The latter may return a
 * Promise; this helper awaits it so callers do not leak unhandled rejections.
 *
 * Errors are propagated; callers decide whether to swallow or log them.
 *
 * @internal
 */
/**
 * Invokes a service instance's synchronous dispose hook if present.
 *
 * Prefers `[Symbol.dispose]` (TC39 explicit-resource-management) over a plain
 * `dispose()` method over `[Symbol.asyncDispose]` (last resort — invoked
 * fire-and-forget since a sync path cannot await it). Exactly one hook is
 * invoked.
 *
 * Returns the hook's result so callers can attach a rejection handler when a
 * Promise is returned. Errors are propagated; callers decide whether to
 * swallow or log them.
 *
 * @internal
 */
export function invokeSyncDispose(instance: unknown): unknown {
    if (!instance || typeof instance !== 'object') {
        return undefined;
    }

    const obj = instance as Record<PropertyKey, unknown>;

    const syncDisposeSymbolFn = obj[Symbol.dispose];
    if (typeof syncDisposeSymbolFn === 'function') {
        return (syncDisposeSymbolFn as () => unknown).call(instance);
    }

    const disposeFn = obj.dispose;
    if (typeof disposeFn === 'function') {
        return (disposeFn as () => unknown).call(instance);
    }

    const asyncDisposeFn = obj[Symbol.asyncDispose];
    if (typeof asyncDisposeFn === 'function') {
        return (asyncDisposeFn as () => unknown).call(instance);
    }

    return undefined;
}

export async function invokeAsyncDispose(instance: unknown): Promise<void> {
    if (!instance || typeof instance !== 'object') {
        return;
    }

    const obj = instance as Record<PropertyKey, unknown>;

    const asyncDisposeFn = obj[Symbol.asyncDispose];
    if (typeof asyncDisposeFn === 'function') {
        await (asyncDisposeFn as () => unknown).call(instance);
        return;
    }

    const syncDisposeSymbolFn = obj[Symbol.dispose];
    if (typeof syncDisposeSymbolFn === 'function') {
        const result = (syncDisposeSymbolFn as () => unknown).call(instance);
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
            await result;
        }
        return;
    }

    const disposeFn = obj.dispose;
    if (typeof disposeFn === 'function') {
        const result = (disposeFn as () => unknown).call(instance);
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
            await result;
        }
    }
}

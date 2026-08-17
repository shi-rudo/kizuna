# ADR-012: Disposal Error Aggregation

## Status

Accepted.

## Context

The old disposal paths caught cleanup errors and wrote them to the console.
Callers could not detect a failed cleanup. Applications also could not choose
their own reporting policy.

Stopping after the first error is not safe. It can leave other owned resources
open. A cleanup error must not block the cleanup of another service.

The sync API cannot wait for a cleanup method that returns a Promise.

## Decision

Both disposal APIs attempt all owned cleanup operations.

After sync cleanup completes, `dispose()` throws one `DisposalError` if an
operation failed. After async cleanup settles, `disposeAsync()` rejects with the
same error type. The `errors` property contains the original error values.

`DisposalError` extends the JavaScript `AggregateError` class. It reports
multiple cleanup errors. It does not represent a domain aggregate.

Kizuna does not write cleanup errors to the console. The caller decides how to
report them.

If a sync cleanup call returns a Promise, Kizuna attaches a rejection handler.
This handler prevents an unhandled rejection. Kizuna adds a `TypeError` to the
`DisposalError`. The error tells the caller to use `disposeAsync()` for future
containers. The Promise has started, but the sync API does not wait for it.

The provider clears its state before it reports the `DisposalError`. A second
disposal call is a no-op, even if the first call reported errors.

The TC39 resource-management symbols use the same behavior as the matching
methods.

## Consequences

- Applications can detect every cleanup failure.
- One cleanup failure does not block other cleanup.
- Async dependencies start after their consumers settle, even when a consumer
  fails.
- Applications must catch disposal errors when they need custom reporting.
- A caller must use `disposeAsync()` before disposal starts if any service has
  asynchronous cleanup.

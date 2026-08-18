# ADR-001: Promise Values in the Unified Container

## Status

Accepted. This text replaces the earlier async-resolution claim.

## Context

Factories use the same synchronous container path as constructors. An `async`
factory returns a `Promise`. The container does not await this `Promise`.

The old ADR called this behavior seamless async resolution. That name implied
async lifecycle management that the container does not supply.

## Decision

The container treats a `Promise` as an asynchronous service value.

- A singleton lifecycle wraps a factory `Promise` and caches the observer
  `Promise` in the root container.
- A scoped lifecycle wraps a factory `Promise` and caches the observer `Promise`
  in each scope.
- The observer `Promise` has the same result or rejection as the factory
  `Promise`. Its object identity can differ.
- Singleton and scoped registry types normalize `PromiseLike<T>` to
  `Promise<Awaited<T>>`. Transient registry types keep the exact factory type.
- Promise-like detection reads `then` once. The lifecycle invokes the captured
  function asynchronously.
- All consumers share the stored `Promise` while it is pending or fulfilled.
- A transient factory creates a new `Promise` for each resolution.
- `get()` returns the `Promise` without awaiting it.
- An active lifecycle removes its stored `Promise` from the cache after
  rejection. The stored `Promise` rethrows the rejection.
- The next `get()` call invokes the failed factory again.
- The lifecycle does not retry without a new resolution request.
- `disposeAsync()` waits for stored singleton and scoped Promises.
- `disposeAsync()` cleans each resolved value with the standard hook priority.
- Disposal keeps ownership of a pending `Promise` and reports a later rejection.
- `dispose()` starts this cleanup but reports that it cannot wait.
- The container does not track or clean transient values.

Use `disposeAsync()` when a singleton or scoped factory returns a Promise.

## Example

```typescript
const container = new ContainerBuilder()
  .registerSingletonFactory('Database', async () => connectToDatabase())
  .build();

const database = await container.get('Database');
```

The registry type for `Database` is `Promise<Database>`. TypeScript therefore
requires the consumer to await the result.

## Consequences

Synchronous services have no `Promise` cost. Each singleton or scoped factory
attempt creates one observer `Promise`. Promise caching prevents the factory
from starting the same operation more than once.

The observer is a native `Promise`. It does not preserve custom properties or
methods from a Promise subclass or thenable. The registry type reflects this
runtime value.

The container does not supply async-aware resolution or creation rollback. All
callers share one pending `Promise` and its result.

After rejection, a new resolution request can start the factory again. Kizuna
does not supply a retry limit, a delay, or backoff.

The consumer receives the original rejection through the stored `Promise`.
Kizuna does not consume that rejection. If a consumer ignores it, normal runtime
unhandled-rejection reporting still applies. If disposal already owns the pending
`Promise`, its `DisposalError` also contains the rejection.

Disposal waits while a stored Promise is pending. A Promise that never settles
also prevents asynchronous disposal from settling.

The consumer owns Promise errors during normal service use. Transient Promise
values remain the responsibility of the consumer.

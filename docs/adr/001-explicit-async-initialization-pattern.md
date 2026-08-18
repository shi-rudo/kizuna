# ADR-001: Promise Values in the Unified Container

## Status

Accepted. This text replaces the earlier async-resolution claim.

## Context

Factories use the same synchronous container path as constructors. An `async`
factory returns a `Promise`. The container does not await this `Promise`.

The old ADR called this behavior seamless async resolution. That name implied
async lifecycle management that the container does not supply.

## Decision

The container treats a `Promise` as a normal service value.

- A singleton factory caches a pending or fulfilled `Promise` in the root container.
- A scoped factory caches a pending or fulfilled `Promise` in each scope.
- A transient factory creates a new `Promise` for each resolution.
- `get()` returns the `Promise` without awaiting it.
- An active lifecycle removes its `Promise` from the cache after rejection.
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

Synchronous services have no `Promise` cost. Promise caching also prevents a
singleton or scoped factory from starting the same operation more than once.

The container does not supply async-aware resolution or creation rollback. All
callers share one pending `Promise` and its result.

After rejection, a new resolution request can start the factory again. Kizuna
does not supply a retry limit, a delay, or backoff.

The original consumer receives the rejection. If disposal already owns the
pending `Promise`, its `DisposalError` also contains the rejection.

Disposal waits while a stored Promise is pending. A Promise that never settles
also prevents asynchronous disposal from settling.

The consumer owns Promise errors during normal service use. Transient Promise
values remain the responsibility of the consumer.

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

- A singleton factory caches its `Promise` in the root container.
- A scoped factory caches its `Promise` in each scope.
- A transient factory creates a new `Promise` for each resolution.
- `get()` returns the `Promise` without awaiting it.
- `disposeAsync()` waits for stored singleton and scoped Promises.
- `disposeAsync()` cleans each resolved value with the standard hook priority.
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

The container does not supply async-aware resolution or creation rollback. A
rejected `Promise` stays cached for its lifecycle.

`disposeAsync()` reports a rejected stored Promise as a cleanup failure. The
original rejection is in the `DisposalError`.

Disposal waits while a stored Promise is pending. A Promise that never settles
also prevents asynchronous disposal from settling.

The consumer owns Promise errors during normal service use. Transient Promise
values remain the responsibility of the consumer.

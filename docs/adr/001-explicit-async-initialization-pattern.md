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
- The container does not dispose the value that the `Promise` resolves to.

Use asynchronous initialization before `build()` when the container must own
the resolved service and its disposal.

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

The container does not supply async-aware creation or rollback. A rejected
cached `Promise` stays cached for its lifecycle. The consumer owns error
handling for that `Promise`.

The container cannot call disposal hooks on the resolved value. Register an
already initialized value if the container must dispose that value.

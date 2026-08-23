# ADR-010: Concurrency Responsibility

## Status

Accepted. This revision removes unsupported adoption and performance claims
from the original decision.

## Context

Kizuna uses mutable lifecycle state for cached values, factories, disposal,
and scope creation. The library does not use locks or another serialization
mechanism.

JavaScript tasks in one isolate can interleave. Workers and isolates also have
separate heaps. Application services can contain their own shared mutable
state.

Thread safety for a DI container does not make its service values thread-safe.
The application owns concurrency rules for those values.

## Decision

Kizuna does not provide thread-safe lifecycle implementations. Kizuna does not
serialize concurrent application work.

Resolution stays synchronous. An `async` factory returns a Promise service
value as ADR-001 defines. This behavior is not asynchronous resolution.

Kizuna does not promise safe container sharing across workers, isolates, or
other heaps.

## Application rules

Create one root container in each worker or isolate. Transfer data between
workers with messages or another application-owned protocol.

Create a scope for each request or operation that needs isolated scoped values.
Dispose that scope after the operation is complete.

Remember that scopes share singleton values. Make singleton state safe for the
concurrent tasks that use it.

Coordinate shutdown with request admission and in-flight work. Start disposal
only after the application stops new resolution work.

If owned values have asynchronous cleanup, use `disposeAsync()`. Disposal marks
the provider as disposed before cleanup starts.

## Example

```typescript
// Run this composition root separately in each worker or isolate.
const root = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerScoped('requestContext', RequestContext)
  .build();

async function handleRequest(): Promise<void> {
  await using scope = root.startScope();
  const context = scope.get('requestContext');
  await processRequest(context);
}
```

## Consequences

The public resolution API remains synchronous. The package has no lock or mutex
dependency.

Applications must choose their worker, request, and singleton concurrency
models. Kizuna cannot prevent unsafe mutation inside a resolved service.

Request scopes isolate scoped values. They do not isolate singleton values or
global application state.

No benchmark in this ADR proves a performance benefit from this decision.

## Alternatives

### Async-first resolution

An async-only API can serialize some container operations. It cannot make
arbitrary service values safe for concurrent use.

Kizuna keeps Promise values explicit instead. ADR-001 defines that contract.

### Optional locking

Optional locks create two lifecycle models and do not protect state inside
services. The application can add coordination at its actual concurrency
boundary.

## Related documentation

- [Concurrency patterns](../concurrency-patterns.md)
- [Promise values](./001-explicit-async-initialization-pattern.md)
- [Scope creation](./006-scope-creation-strategy.md)

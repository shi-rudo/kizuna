# ADR-006: Scope Creation Strategy

## Status

Accepted. Revised on 2026-10-12: a scope creates its services on their first
resolution instead of when the scope starts.

This ADR defines registration replication for `startScope()`. ADR-003 defines
the public builder and container types.

## Context

A scoped service needs one value for each root container or child scope.
Singleton values must stay shared. Transient values must remain untracked.

The container can implement scopes with parent lookup chains or with replicated
registrations. Parent chains make resolution and ownership depend on another
container.

The first version replicated every registration when a scope started. A scope
over 1000 registrations then cost about 145 µs before it resolved a service.
Its disposal built the disposal graph over all registrations again, even if
the scope had created only a few services.

## Decision

A scope is an independent container. It does not look up services in its
parent, and it creates its own wrapper for each registration that it
resolves.

Scoped and transient lifecycles create new lifecycle instances. Singleton and
borrowed singleton lifecycles stay shared.

Each new wrapper copies the service key, dependency keys, constructor metadata,
lifetime, and value-ownership metadata.

A wrapper does not own a shared lifecycle. Therefore, scope disposal does not
clean a singleton or borrowed singleton value.

### Shared catalog

`build()` creates one catalog of the registrations. It holds the lookup maps
and the registration order of the builder, which no longer change after
`build()`. The root and all of its scopes share it. The order includes single
registrations and all entries in multi-registration groups.

### Wrappers on first resolution

A scope creates the wrapper of a registration when it resolves the key for the
first time, and keeps it for later lookups. `startScope()` therefore does not
depend on the registry size.

The scope creates the wrapper from a prototype. The root creates one prototype
for each registration on its first `startScope()`, with the replication rules
above, and all scopes share them. A prototype is never resolved, closed, or
disposed. It therefore keeps its factory after the root is disposed, and a live
scope can still create a scoped service for the first time.

### Ownership

The root resolves through the maps of the catalog and owns the wrapper of
every registration from the start. It also cleans a singleton value that only
a scope resolved.

A scope has its own lookup maps and owns only the wrappers that it created. It
records a wrapper before it resolves it, so a factory that disposes its own
scope still closes the lifecycle that it runs in.

## Runtime behavior

```typescript
const root = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerScoped('requestContext', RequestContext)
  .registerTransient('command', Command)
  .build();

const firstScope = root.startScope();
const secondScope = root.startScope();

firstScope.get('logger') === secondScope.get('logger'); // true
firstScope.get('requestContext') === secondScope.get('requestContext'); // false
firstScope.get('command') === firstScope.get('command'); // false
```

The root container is also a scope for scoped values. A scoped value in the
root differs from the value in each child scope.

A scope can create another scope. The new scope uses the same catalog and
prototypes as its source scope.

## Ownership and disposal

The container does not track its child scopes. The application must dispose each
child scope before it disposes the root container.

Scope disposal cleans owned scoped values. It clears transient lifecycle
configuration, but it cannot clean transient values because it does not track
them.

Scope disposal does not clean shared singleton values. The root owner cleans
these values. A borrower never cleans a borrowed singleton.

The disposal order follows ADR-011 over the full catalog. The catalog computes
the disposal plan once. A scope walks this plan and skips the registrations
that it did not create. An edge through such a registration still orders the
services around it.

## Consequences

Resolution does not need a parent-container lookup. Each scope has its own
wrappers and lookup maps.

`startScope()` takes constant time. The first scope of a root also creates the
prototypes, once for each registration. `build()` does not copy the
registration maps.

The first resolution of a key in a scope creates its wrapper. Later lookups
take one map lookup, as in the root.

Scope disposal does not build a graph. It walks the shared plan, which takes
time linear in the registry size.

The root walks the same plan. In the benchmarks, the one-time sync disposal of
a root with 100 or more services took up to about a fifth longer than with a
plan built inside the container, although the plan code did not change. A root
disposes once, so this cost stays in the order of microseconds.

The prototypes keep the registration factories alive for as long as the root
or a scope can reach the catalog.

Singleton identity stays stable across scopes. Scoped values stay isolated.
Transient values remain new for each resolution.

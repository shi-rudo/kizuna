# ADR-006: Scope Creation Strategy

## Status

Accepted.

This ADR defines registration replication for `startScope()`. ADR-003 defines
the public builder and locator types.

## Context

A scoped service needs one value for each root container or child scope.
Singleton values must stay shared. Transient values must remain untracked.

The provider can implement scopes with parent lookup chains or with replicated
registrations. Parent chains make resolution and ownership depend on another
provider.

## Decision

`startScope()` creates an independent provider from the current provider
registrations. Each scope gets a new wrapper for each registration.

Scoped and transient lifecycles create new lifecycle instances. Singleton and
borrowed singleton lifecycles stay shared.

Each new wrapper copies the service key, dependency keys, constructor metadata,
lifetime, and value-ownership metadata.

A wrapper does not own a shared lifecycle. Therefore, scope disposal does not
clean a singleton or borrowed singleton value.

The new provider also copies the registration order. This order includes
single registrations and all entries in multi-registration groups.

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

A scope can create another scope. The new scope repeats the same replication
rules from its source scope.

## Ownership and disposal

The provider does not track its child scopes. The application must dispose each
child scope before it disposes the root container.

Scope disposal cleans owned scoped values. It clears transient lifecycle
configuration, but it cannot clean transient values because it does not track
them.

Scope disposal does not clean shared singleton values. The root owner cleans
these values. A borrower never cleans a borrowed singleton.

## Consequences

Resolution does not need a parent-provider lookup. Each scope has its own maps,
wrappers, and registration order.

Scope creation performs work for every registration. Its time and allocation
cost therefore increase with the registry size.

Singleton identity stays stable across scopes. Scoped values stay isolated.
Transient values remain new for each resolution.

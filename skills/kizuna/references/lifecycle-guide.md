# Lifecycle Guide

Every registration in Kizuna has one of three lifecycles. The lifecycle controls when instances are created, reused, and disposed.

## Quick reference

| Lifecycle | Instance creation | Sharing | Disposal | Use for |
| --- | --- | --- | --- | --- |
| Singleton | Lazy, on first `get()` | One instance forever | Instance cleanup runs when root container is disposed (see [Disposal behavior](#disposal-behavior) for sync vs async resolution rules) | DB pools, config, loggers |
| Scoped | Lazy, on first `get()` within scope | One per scope | Instance cleanup runs when scope is disposed (see [Disposal behavior](#disposal-behavior)) | Per-request state, transactions |
| Transient | Every `get()` call | Never shared | Not tracked | Stateless services, timestamps, UUIDs |

## Singleton

```typescript
const Cache = interfaceToken<ICache>()('cache');

new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingletonInterface(Cache, RedisCache, 'logger')
  .registerSingletonFactory('config', () => loadConfig())
```

- Created on first `get()`, cached forever.
- Shared across all scopes — `container.get('logger') === scope.get('logger')`.
- When the **root container** is disposed, `SingletonLifecycle.dispose()` calls `instance.dispose()` if the instance has that method. The singleton is then permanently marked as disposed.
- **Child scope disposal does NOT dispose singletons** — `ServiceWrapper` sets `ownsLifecycle = false` for shared singleton lifecycles, preventing child scopes from triggering singleton cleanup.
- After disposal, `get()` throws `"Cannot resolve from a disposed singleton lifecycle"`.

```typescript
const container = builder.build();
const pool = container.get('dbPool');

container.dispose(); // pool.dispose() is called automatically if it exists
// container.get('dbPool'); // throws: Cannot access services from a disposed container
```

## Scoped

```typescript
const Transaction = interfaceToken<ITransaction>()('tx');

new ContainerBuilder()
  .registerScoped('userService', UserService, 'logger')
  .registerScopedInterface(Transaction, DbTransaction, 'pool')
  .registerScopedFactory('requestId', () => crypto.randomUUID())
```

- Created on first `get()` within each scope, cached for that scope.
- Different scopes get different instances.
- `dispose()` calls `instance.dispose()` if the instance has that method (scoped.ts:233-249). Always dispose scopes when done.
- After disposal, `get()` throws `"Cannot resolve from a disposed scoped lifecycle"`.

## Transient

```typescript
.registerTransient('commandHandler', CommandHandler, 'logger')
.registerTransientFactory('timestamp', () => Date.now())
```

- Created fresh on every `get()` call. Never cached.
- Instances are not tracked by the lifecycle — the container does not hold references and cannot dispose them.
- After disposal, `get()` throws `"Cannot resolve from a disposed transient lifecycle"`.

## Choosing the right lifecycle

```
Does this service hold state? ─── No ──→ Transient
        │
       Yes
        │
Is the state per-request? ─── Yes ──→ Scoped
        │
       No (application-wide)
        │
       Singleton
```

## Captive dependency trap

A **captive dependency** occurs when a long-lived service depends on a short-lived one. The long-lived service captures the first instance and holds it forever.

```typescript
// BUG: singleton captures the first scope's RequestContext
new ContainerBuilder()
  .registerScoped('requestContext', RequestContext)
  .registerSingleton('userService', UserService, 'requestContext')
  .build();
```

`validate()` reports this as a captive dependency issue (singleton depending on scoped) — run it before `build()`.

**Rule:** A service should only depend on services with equal or longer lifetimes.

| Depending service | Can depend on |
| --- | --- |
| Singleton | Singleton only |
| Scoped | Singleton, Scoped |
| Transient | Singleton, Scoped, Transient |

## Factory return values

Both `SingletonLifecycle` and `ScopedLifecycle` use a boolean `_initialized` flag to track whether an instance has been created. This means **any return value is cached correctly** — including `null`, `undefined`, `0`, and `false`. There is no "null breaks caching" issue.

```typescript
// All of these work correctly — value is cached after first call
.registerSingletonFactory('maybeNull', () => null)      // cached as null
.registerSingletonFactory('maybeUndef', () => undefined) // cached as undefined
.registerSingletonFactory('zero', () => 0)               // cached as 0
```

## Disposal behavior

### Ownership

Kizuna cleans only values that it owns and tracks.

| Value | Cleanup owner |
|---|---|
| Singleton | The root container that registered it |
| Scoped | The container or scope that resolved it |
| Transient | The caller. Kizuna does not track transient values. |
| Borrowed singleton | The source root container |

A child scope does not clean shared singletons. A borrower does not clean
borrowed values.

Kizuna does not track child scopes. Dispose each scope before its root
container. With borrowed singletons, use this shutdown order:

1. Child scopes
2. Borrower root containers
3. The source root container

### Choose the API

`disposeAsync()` is the default for application shutdown. It supports
synchronous hooks and waits for asynchronous hooks.

The `dispose()` method is suitable only when every owned value has synchronous
cleanup. It cannot wait for a Promise.

Call only one disposal API on a container. The first call marks the container
as disposed. Later disposal calls are no-ops.

### Hook selection

Each value uses at most one cleanup hook.

| Container API | Hook priority |
|---|---|
| `disposeAsync()` | `[Symbol.asyncDispose]` → `[Symbol.dispose]` → `dispose()` |
| `dispose()` | `[Symbol.dispose]` → `dispose()` → `[Symbol.asyncDispose]` |

The async API waits for the selected hook. If the sync API receives a Promise,
cleanup starts, but the API cannot wait for it. The `DisposalError` then
contains a `TypeError`.

`[Symbol.dispose]()` calls `dispose()`. `[Symbol.asyncDispose]()` calls
`disposeAsync()`. These symbols support `using` and `await using`.

### Cleanup order

Kizuna gets cleanup order from declared registration dependencies. It cleans a
consumer before its dependencies.

For example, `UserService` can depend on `UserRepository`. The repository can
depend on `DatabasePool`. Kizuna cleans these values in this order:

1. `UserService`
2. `UserRepository`
3. `DatabasePool`

The async API starts a dependency after all its consumers finish cleanup.
Independent graph branches run in parallel. Their relative completion order is
not defined.

Sync cleanup keeps registration order inside each disposal layer. All services
under a multi-registration key are part of the graph.

Factory lookups do not declare dependency keys. Therefore, these lookups do not
define cleanup order. When cleanup order is necessary, use a constructor
registration with explicit dependency keys.

### Promise factory values

Singleton and scoped factories can return Promises. The lifecycle stores an
observer Promise. All consumers share that stored Promise.

The stored Promise has the same result or rejection as the factory Promise. It
can have a different object identity.

Singleton and scoped factories normalize `PromiseLike<T>` to
`Promise<Awaited<T>>`. Transient factories keep their exact return type.

The async API waits for a stored Promise and cleans its resolved value. The
container does not track transient values or transient Promises.

If an active lifecycle stores a rejected Promise, it removes that Promise from
the cache. The next resolution invokes the factory again. Consumers must handle
the original rejection.

If disposal starts before the Promise settles, the lifecycle keeps ownership.
The async API reports a later rejection in its `DisposalError`.

### Errors and final state

Both APIs attempt every cleanup operation. They report all failures in one
`DisposalError`. Kizuna does not write cleanup errors to the console.

The `errors` property contains the original errors. The `failures` property
identifies the service key, lifetime, cleanup operation, and original error.

`DisposalError` extends the JavaScript `AggregateError` class. It does not
represent a domain aggregate.

The container clears its internal maps before it reports errors. Later calls to
`get()`, `getAll()`, or `startScope()` throw
`"Cannot access services from a disposed container"`.

## startScope() allocates O(n) objects

Every `startScope()` call creates a new `ServiceProvider`, new maps, and one new
`ServiceWrapper` for each registration. Singleton wrappers still share their
lifecycle. Large containers can create allocation pressure at high request
rates.

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

Two disposal APIs on every lifecycle and on the container:

- `dispose()` — synchronous. Calls each instance's cleanup method. It cannot await Promises.
- `disposeAsync()` — awaits service-owned async cleanup. It waits for all consumers before it starts dependency cleanup.

Both APIs process consumers before their declared dependencies. `disposeAsync()` starts a dependency after all its consumers complete cleanup.

Both APIs attempt all cleanup operations. `dispose()` throws one
`AggregateError` after sync cleanup completes. `disposeAsync()` rejects with one
`AggregateError` after all cleanup settles. The `errors` property contains the
original errors. Kizuna does not write cleanup errors to the console.

Independent cleanup can run in parallel. A slow, unrelated service does not delay dependency cleanup in another graph branch.

This order includes all services under a multi-registration key. Sync disposal keeps registration order within each disposal layer.

Async order between independent branches depends on completion timing. If cleanup order is required, declare a dependency.

Factory lookups do not affect disposal order because factories do not declare dependency keys.

Both are idempotent (second call is a no-op). All check `_isDisposed` before `_factory` in `getInstance()`, so after disposal you always get a clear "disposed" error, not a misleading "no factory" error.

The `ServiceProvider` (container) also exposes TC39 hooks:
- `[Symbol.dispose]()` — alias for `dispose()`. Enables `using` syntax.
- `[Symbol.asyncDispose]()` — alias for `disposeAsync()`. Enables `await using` syntax.

**Per-API resolution rules:**
- `disposeAsync()` picks the instance's cleanup method by priority: `[Symbol.asyncDispose]` → `[Symbol.dispose]` → `dispose()`. The first one present is awaited.
- `dispose()` (sync) picks by priority: `[Symbol.dispose]` → `dispose()` → `[Symbol.asyncDispose]`. The async hook is a last resort. If the selected hook returns a Promise, cleanup starts, but the aggregate contains a `TypeError` because `dispose()` cannot wait for the Promise.

After `container.dispose()` or `container.disposeAsync()`:
- `get()`, `getAll()`, `startScope()` throw `"Cannot access services from a disposed container"`.
- Internal registration maps are cleared to allow GC of all service wrappers and lifecycle objects.

**Pick the async variant when:** any registered service's `dispose` returns a Promise (e.g. `await pool.end()`, `await kafkaProducer.disconnect()`), or implements `Symbol.asyncDispose`. The sync `dispose()` cannot await these and the cleanup may be in flight when the next operation runs.

## startScope() allocates O(n) objects

Every `startScope()` call creates a new `ServiceProvider`, a new record, and a new `ServiceWrapper` for every registered service — including singletons (whose `createScope()` returns `this` but still gets wrapped). With many services and high request throughput, this can produce significant allocation pressure.

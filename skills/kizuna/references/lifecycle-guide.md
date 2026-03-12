# Lifecycle Guide

Every registration in Kizuna has one of three lifecycles. The lifecycle controls when instances are created, reused, and disposed.

## Quick reference

| Lifecycle | Instance creation | Sharing | Disposal | Use for |
| --- | --- | --- | --- | --- |
| Singleton | Lazy, on first `get()` | One instance forever | Calls `dispose()` on instance when root container is disposed | DB pools, config, loggers |
| Scoped | Lazy, on first `get()` within scope | One per scope | Calls `dispose()` on instance if it exists | Per-request state, transactions |
| Transient | Every `get()` call | Never shared | Not tracked | Stateless services, timestamps, UUIDs |

## Singleton

```typescript
.registerSingleton('logger', Logger)
.registerSingletonInterface<ICache>('cache', RedisCache, 'logger')
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
.registerScoped('userService', UserService, 'logger')
.registerScopedInterface<ITransaction>('tx', DbTransaction, 'pool')
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

`validate()` does NOT check for lifecycle mismatches. You must audit this manually.

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

All three lifecycles implement idempotent `dispose()` — calling it twice is safe (second call is a no-op). All check `_isDisposed` before `_factory` in `getInstance()`, so after disposal you always get a clear "disposed" error, not a misleading "no factory" error.

The `ServiceProvider` (container) also tracks disposal state:
- `get()`, `getAll()`, `startScope()` all throw `"Cannot access services from a disposed container"` after `container.dispose()`.
- `dispose()` clears internal registration maps to allow GC of all service wrappers and lifecycle objects.

## startScope() allocates O(n) objects

Every `startScope()` call creates a new `ServiceProvider`, a new record, and a new `ServiceWrapper` for every registered service — including singletons (whose `createScope()` returns `this` but still gets wrapped). With many services and high request throughput, this can produce significant allocation pressure.

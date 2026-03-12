# Lifecycle Guide

Every registration in Kizuna has one of three lifecycles. The lifecycle controls when instances are created, reused, and disposed.

## Quick reference

| Lifecycle | Instance creation | Sharing | Disposal | Use for |
| --- | --- | --- | --- | --- |
| Singleton | Lazy, on first `get()` | One instance forever | No-op (intentional) | DB pools, config, loggers |
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
- `dispose()` is a **silent no-op** (singleton.ts:179). When you call `container.dispose()`, singleton instances are NOT cleaned up. If a singleton holds a database pool, that pool stays open.
- `isDisposed` always returns `false`.

For shutdown cleanup, explicitly close singleton resources before calling `container.dispose()`.

## Scoped

```typescript
.registerScoped('userService', UserService, 'logger')
.registerScopedInterface<ITransaction>('tx', DbTransaction, 'pool')
.registerScopedFactory('requestId', () => crypto.randomUUID())
```

- Created on first `get()` within each scope, cached for that scope.
- Different scopes get different instances.
- `dispose()` calls `instance.dispose()` if the instance has that method (scoped.ts:226-228). Always dispose scopes when done.

## Transient

```typescript
.registerTransient('commandHandler', CommandHandler, 'logger')
.registerTransientFactory('timestamp', () => Date.now())
```

- Created fresh on every `get()` call. Never cached.
- Instances are not tracked by the lifecycle — the container does not hold references and cannot dispose them.

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

## Null factory return breaks caching

Both `SingletonLifecycle` and `ScopedLifecycle` use `if (this._instance === null)` to detect uncreated instances. If a factory returns `null`, the lifecycle re-runs the factory on every `get()` call.

```typescript
// BAD: null breaks caching — "singleton" becomes transient
.registerSingletonFactory('optionalConfig', () => {
  return process.env.CONFIG ? loadConfig() : null;
})

// GOOD: undefined is cached correctly
.registerSingletonFactory('optionalConfig', () => {
  return process.env.CONFIG ? loadConfig() : undefined;
})
```

## Singleton dispose is a no-op

```typescript
const container = builder.build();
const pool = container.get('dbPool');

container.dispose();
// pool is still open — SingletonLifecycle.dispose() does nothing
// The ServiceWrapper nulls its lifecycle reference, making the wrapper unusable,
// but the singleton instance itself is never cleaned up.

// For proper shutdown:
pool.close(); // manually close before dispose
container.dispose();
```

## startScope() allocates O(n) objects

Every `startScope()` call creates a new `ServiceProvider`, a new record, and a new `ServiceWrapper` for every registered service — including singletons (whose `createScope()` returns `this` but still gets wrapped). With many services and high request throughput, this can produce significant allocation pressure.

# ADR-009: Typed Locator Factory Signature

## Status

Accepted. This text replaces the legacy `Factory<T>` and `ServiceLocator`
contract.

## Context

A factory needs access to services that exist before its registration. The
factory parameter must keep the inferred registry type.

The old contract used an unrestricted locator. It also declared `T | Promise<T>`.
That declaration did not match the builder or the runtime lifecycle behavior.

## Decision

The internal factory contract is:

```typescript
type Factory<TRegistry, T> = (
  serviceProvider: TypeSafeServiceLocator<TRegistry>,
) => T;
```

The package root does not export this helper type. Registration methods infer
the factory type. This design keeps one registry-aware contract through the
builder and lifecycle implementation.

Factory keys must be fixed string literals. Broad strings, unions, and open
template-literal types do not create safe registry entries.

## Example

```typescript
const container = new ContainerBuilder()
  .registerSingleton('Config', ConfigService)
  .registerSingleton('Logger', LoggerService)
  .registerSingletonFactory('Database', (provider) => {
    const config = provider.get('Config');
    const logger = provider.get('Logger');
    return new DatabaseService(config.connectionString, logger);
  })
  .build();
```

The factory can only resolve entries that exist before `Database` in the
builder chain. The returned service becomes the registry value for `Database`.

## Promise Values

An `async` function infers `T` as `Promise<Service>`. A singleton or scoped
lifecycle wraps that value and stores the observer `Promise`. It does not await
the `Promise`. The stored value has the same result or rejection as the factory
value, but it can have a different object identity. Singleton and scoped
registrations normalize a `PromiseLike<T>` result to `Promise<Awaited<T>>`.
Transient registrations keep the exact factory return type.

`disposeAsync()` waits for stored singleton and scoped Promises. It cleans each
resolved value. An active lifecycle removes a rejected `Promise` from its cache.
ADR-001 defines the full Promise-value contract.

## Consequences

Factories keep full registry inference without casts to an unrestricted
locator. Consumers do not need to import a factory helper type.

Factories can hide dependencies because they resolve services in their body.
Constructor registration is better when the dependency list is fixed.

The package does not promise custom lifecycle strategies or asynchronous
service resolution.

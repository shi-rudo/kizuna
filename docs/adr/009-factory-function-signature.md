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
  resolver: TypeSafeServiceResolver<TRegistry>,
) => T;
```

The package root does not export the `Factory` helper type. Registration
methods infer this type. The package exports `TypeSafeServiceResolver` for code
that needs an explicit factory parameter type.

The resolver only provides `get()` and `getAll()`. It does not provide scope,
disposal, or self-resolution operations. This boundary prevents accidental
lifecycle changes through the callback argument.

Factory code remains trusted application code. A factory can still use a
container reference that it gets from another source.

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
  }, 'Config', 'Logger')
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

Factories keep full registry inference without an unrestricted locator.
Consumers do not need to import a factory helper type.

Factory methods accept dependency keys after the factory. These keys define
validation edges and cleanup order. TypeScript rejects unknown keys.

An undeclared resolver lookup stays invisible to the graph. Declare each fixed
lookup that affects a lifetime rule or cleanup order.

The package does not promise custom lifecycle strategies or asynchronous
service resolution.

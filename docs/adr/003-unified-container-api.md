# ADR-003: Unified Container API

## Status

Accepted.

Later decisions amend parts of this ADR:

- [ADR-001](./001-explicit-async-initialization-pattern.md) defines Promise
  values from factories.
- [ADR-008](./008-self-registration-pattern.md) defines provider
  self-resolution.
- [ADR-009](./009-factory-function-signature.md) defines the typed factory
  parameter.
- [ADR-011](./011-dependency-aware-disposal-order.md) defines cleanup order.
- [ADR-012](./012-disposal-error-aggregation.md) defines cleanup errors.

## Context

Kizuna previously explored separate fluent and typed registration APIs. Two
APIs increased the learning and maintenance cost. They also had different
feature sets.

## Decision

Kizuna supplies one `ContainerBuilder` API for constructor, interface, and
factory registrations.

```typescript
const database = interfaceToken<IDatabase>()('database');
const cache = interfaceToken<ICache>()('cache');

const container = new ContainerBuilder()
  .registerSingleton('logger', ConsoleLogger)
  .registerSingletonInterface(database, PostgreSQLDatabase, 'logger')
  .registerScopedInterface(cache, RedisCache, 'logger')
  .registerScoped('userService', UserService, database, 'logger')
  .registerSingletonFactory('config', (provider) => {
    const logger = provider.get('logger');
    return createConfiguration(logger);
  }, 'logger')
  .build();

container.get('logger');
container.get(database);
container.get('userService');
container.get('config');
```

Each registration method adds its key and service type to the inferred
registry. Later registrations can use keys that already exist in this
registry.

`build()` returns a `RootServiceContainer<TRegistry>`. `startScope()` returns a
`TypeSafeServiceLocator<TRegistry>`.

## Registration contracts

### Constructor registrations

Constructor registrations accept a concrete class and its dependency keys.
TypeScript compares each key type with the constructor parameter at the same
position. It also checks the dependency count.

The builder must contain each dependency before its consumer registration.
Each registration key must be one fixed string literal.

TypeScript uses structural assignability. It cannot distinguish two keys when
both keys provide the same structural type. Runtime validation does not inspect
parameter names.

### Interface registrations

`interfaceToken<T>()(key)` connects a string key with an interface type. The
implementation constructor must produce that interface type.

Interface constructor dependencies use the same count, type, and position
checks as concrete constructor registrations.

### Factory registrations

A factory receives a resolver for the registry that exists before the factory
registration. The factory return type becomes the service type for its key.

Factory keys must be fixed string literals. A factory can declare dependency
keys after its function. These keys define validation edges and cleanup order.

An undeclared resolver lookup does not create dependency metadata.

ADR-009 defines the factory type. ADR-001 defines Promise values from an
`async` factory.

### Lifecycles

Constructor, interface, and factory registrations support these lifecycles:

- Singleton
- Scoped
- Transient

The matching `add*` methods add multiple services under one key. The public API
does not provide a custom lifecycle extension point.

## Resolution contracts

Registered services use their fixed string keys. An interface token carries
its fixed string key and its interface type.

`ServiceProviderToken` is the only non-string resolution token. It returns the
current root container or scope. A user can register the string key
`"ServiceProvider"` without a collision.

Arbitrary constructors are not resolution tokens. ADR-008 defines this
decision.

## Validation contracts

TypeScript rejects unknown dependency keys in typed constructor registrations.
JavaScript callers and unsafe casts can still create invalid graphs.

`validate()` reports missing dependencies, captive dependencies, circular
dependencies, invalid keys, and disposed registrations. It uses the declared
dependency keys. It does not inspect constructor parameter names.

By default, `build()` validates the graph before it creates the root container.
Both `validate()` and eager `build()` report the same graph errors.
`build({ validation: 'deferred' })` skips this eager check for compatibility.
The container then reports resolution errors when a consumer requests a service.

Some errors occur during registration. Other errors occur during validation or
resolution. ADR-007 records the historical fail-fast decision.

## Consequences

The fluent chain preserves registry inference across all registration
patterns. Users can mix concrete classes, interface tokens, and factory values
in one container.

The API has many methods because each pattern has three lifecycles and a
multi-registration variant. The type system also increases compiler work for
large registries.

The public type contract prevents many invalid TypeScript registrations. It
does not replace runtime validation for JavaScript or unsafe casts.

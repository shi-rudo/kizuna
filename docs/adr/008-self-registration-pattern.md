# ADR-008: Explicit Provider Self-Resolution

## Status

Accepted. This decision supersedes automatic provider registration under a
string key.

## Context

Infrastructure code sometimes needs the current service provider. An automatic
string registration made that dependency look like a normal application
service. It also reserved a user-facing key.

The provider needs one stable identity that cannot collide with a user key.
Normal services still need explicit constructor dependencies.

## Decision

The provider is not part of the string-key registry. Kizuna does not create a
hidden provider registration.

`get(ServiceProviderToken)` returns the current provider. A root call returns
the root container. A scope call returns that scope.

`ServiceProviderToken` is an exported unique symbol. It cannot collide with the
string key `"ServiceProvider"`.

A factory receives a `TypeSafeServiceResolver`. This interface does not accept
`ServiceProviderToken`. ADR-009 defines this factory contract.

Constructor dependencies still use registered service keys. They cannot use
`ServiceProviderToken` as a dependency key. Arbitrary constructors are also not
resolution tokens.

## Type-safety boundary

TypeScript rejects an unregistered provider dependency during registration.
JavaScript callers and unsafe casts can defer this error to validation or
resolution.

The token gives infrastructure code explicit access to the current provider.
It does not make the provider a normal registered dependency.

## Factory example

```typescript
const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingletonFactory('diagnostics', (provider) => {
    const logger = provider.get('logger');
    return new Diagnostics(logger);
  }, 'logger')
  .build();
```

The factory parameter is the preferred dependency resolver for factory code.

## Explicit infrastructure lookup

```typescript
import { ContainerBuilder, ServiceProviderToken } from '@shirudo/kizuna';

class DiagnosticService {}

const container = new ContainerBuilder()
  .registerSingleton('ServiceProvider', DiagnosticService)
  .build();

container.get(ServiceProviderToken); // The current provider
container.get('ServiceProvider'); // DiagnosticService
```

The symbol lookup and the string lookup return different values.

## Consequences

The container does not reserve a string key for itself. User registrations can
use the text `"ServiceProvider"`.

Constructor signatures continue to show normal service dependencies. Dynamic
provider access remains explicit in infrastructure code.

Factory code remains trusted application code. It can use a container reference
that it gets from another source.

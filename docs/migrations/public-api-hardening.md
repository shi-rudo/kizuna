# Public API Hardening Migration

This release limits the package root to supported consumer contracts. It also
removes builder operations that made the runtime registry differ from its type.

## Public Exports

The package root now exports these runtime values:

- `ContainerBuilder`
- `interfaceToken`
- `ServiceContainerToken`
- `ServiceProviderToken` (deprecated alias of `ServiceContainerToken`)
- `CircularDependencyError`
- `ContainerValidationError`
- `DisposalError`

It also exports these public types:

- `RootServiceContainer`
- `ServiceContainer`
- `TypeSafeServiceLocator` (deprecated alias of `ServiceContainer`)
- `MultiRegistration`
- `InterfaceToken`
- `DisposalFailure`
- `DisposalOperation`
- `ContainerBuildOptions`
- `ValidationIssue`
- `ValidationIssueCode`
- `ValidationPathSegment`

The concrete container class, lifecycle classes, service wrappers, and
registrar helpers are internal. Do not import them from the package root or a
package subpath.

## Container Access

Do not construct or extend the concrete container class. Build a container and
use its public `ServiceContainer` contract.

```typescript
const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .build();
```

Use `ServiceContainerToken` when infrastructure code needs the current
container. The token returns the root container from the root container. It
returns the scope from a scope.

```typescript
const root = container.get(ServiceContainerToken);
const scope = container.startScope();
const currentScope = scope.get(ServiceContainerToken);
```

Both values have the type `ServiceContainer<TRegistry>`. The concrete container
type is not public.

## Renamed Container Contracts

The container terms now follow one glossary. A container resolves services. The
root container comes from `build()`. A scope comes from `startScope()`.

| Previous name | Current name |
| --- | --- |
| `TypeSafeServiceLocator` | `ServiceContainer` |
| `ServiceProviderToken` | `ServiceContainerToken` |

The previous names remain as deprecated aliases. `ServiceProviderToken` holds
the same symbol as `ServiceContainerToken`. A future major version removes the
aliases. Replace them when you update:

```typescript
// Before
import { ServiceProviderToken, type TypeSafeServiceLocator } from '@shirudo/kizuna';

// After
import { ServiceContainerToken, type ServiceContainer } from '@shirudo/kizuna';
```

## Single and Multi-Registration Resolution

`get()` and `getAll()` now follow the registration method of the key:

- `get()` resolves keys from `register*()` and interface tokens.
- `getAll()` resolves keys from `add*()`.

The wrong method fails at compile time. At runtime, it throws an error that
names the correct method. Earlier versions returned an array from `get()` for an
`add*()` key and wrapped a single registration in an array for `getAll()`.

```typescript
// Before
const handlers = container.get('handlers');
const [config] = container.getAll('config');

// After
const handlers = container.getAll('handlers');
const config = container.get('config');
```

A constructor dependency on an `add*()` key still receives all services as an
array. A factory must call `getAll()` for an `add*()` key.

The registry type marks an `add*()` key as `MultiRegistration<T>` instead of
`T[]`. Update hand-written registry types:

```typescript
// Before
type Registry = { handlers: Handler[] };

// After
type Registry = { handlers: MultiRegistration<Handler> };
```

The builder property `count` counted keys, not registrations. Use `keyCount` or
`registrationCount`. `count` remains as a deprecated alias of `keyCount`.

## Builder Changes

`remove()` and `clear()` no longer exist. These methods changed registrations at
runtime but left the inferred registry type unchanged.

Create a new builder when you need a different registration set. For tests, put
the registration choice before builder creation.

```typescript
function createContainer(databaseFactory: () => Database) {
  return new ContainerBuilder()
    .registerSingletonFactory('Database', databaseFactory)
    .registerScoped('UserService', UserService, 'Database')
    .build();
}
```

`isRegistered()` now accepts a string key only. Constructor names are not
service keys.

## Factory Keys

All six factory methods require one fixed string-literal key. This rule now
matches constructor and interface registrations.

Do not pass a `string`, a string union, or an open template-literal type as the
key. These types can claim registry entries that do not exist at runtime.

## Removed Helper Contracts

The package root no longer exports these implementation or legacy contracts:

- `ServiceProvider`
- `ServiceLocator`
- `ServiceKey`
- `Factory`
- `Container`
- `ServiceBuilder`
- `TypeSafeRegistrar`
- lifecycle classes and `ServiceWrapper`

Let registration methods infer factory and registrar types. Resolve services by
their registered string keys or interface tokens.

## Promise Factory Values

An `async` factory produces a `Promise` service value. Singleton and scoped
lifecycles wrap it in an observer `Promise` and return that value without
awaiting it. The stored value has the same result or rejection as the factory
value, but it can have a different object identity. The lifecycle caches the
stored `Promise` while it is pending or fulfilled. It removes the stored
`Promise` after rejection.

The inferred registry type for a singleton or scoped `PromiseLike<T>` factory is
`Promise<Awaited<T>>`. Do not use custom properties from the original Promise
subclass or thenable. Transient factories still return their exact factory value.

The next resolution request invokes the failed factory again. The lifecycle
does not retry automatically.

Use `disposeAsync()` to wait for that Promise and clean its resolved value. The
container does not track or clean transient values.

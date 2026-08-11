# Public API Hardening Migration

This release limits the package root to supported consumer contracts. It also
removes builder operations that made the runtime registry differ from its type.

## Public Exports

The package root now exports these runtime values:

- `ContainerBuilder`
- `interfaceToken`
- `ServiceProviderToken`
- `CircularDependencyError`

It also exports the `TypeSafeServiceLocator` and `InterfaceToken` types.

Concrete providers, lifecycle classes, service wrappers, and registrar helpers
are internal. Do not import them from the package root or a package subpath.

## Provider Access

Do not construct or extend `ServiceProvider`. Build a container and use its
public locator contract.

```typescript
const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .build();
```

Use `ServiceProviderToken` when infrastructure code needs the current locator.
The token returns the root locator from the root container. It returns the scope
locator from a scope.

```typescript
const root = container.get(ServiceProviderToken);
const scope = container.startScope();
const currentScope = scope.get(ServiceProviderToken);
```

Both values have the type `TypeSafeServiceLocator<TRegistry>`. The concrete
provider type is not public.

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

An `async` factory produces a `Promise` service value. The container returns the
`Promise` without awaiting it. Singleton and scoped lifecycles cache the
`Promise` for their lifecycle.

The container does not dispose the value that the `Promise` resolves to. Perform
asynchronous initialization before `build()` when the container must dispose the
resolved value.

# Typed interface dependency keys

Kizuna now checks interface registration dependency keys during TypeScript
compilation.

This change affects these methods:

- `registerSingletonInterface`
- `registerScopedInterface`
- `registerTransientInterface`

Each dependency key must identify a registered service. The service type must
match the implementation constructor parameter at the same position.

Register each dependency before you register its consumer. TypeScript uses the
current builder registry for the check.

## Migration

An interface registration without constructor dependencies does not change:

```typescript
const builder = new ContainerBuilder()
  .registerSingletonInterface<Logger, 'logger'>('logger', ConsoleLogger);
```

If the implementation has constructor dependencies, add its constructor type as
the third type argument:

```typescript
class EmailService implements Email {
  constructor(readonly logger: Logger, readonly config: Config) {}
}

const builder = new ContainerBuilder()
  .registerSingletonInterface<Logger, 'logger'>('logger', ConsoleLogger)
  .registerSingletonInterface<Config, 'config'>('config', AppConfig)
  .registerScopedInterface<Email, 'email', typeof EmailService>(
    'email',
    EmailService,
    'logger',
    'config'
  );
```

The third type argument lets TypeScript inspect the implementation constructor.
TypeScript cannot infer a later type argument after explicit type arguments.

If TypeScript reports an error, make these changes:

1. Register each dependency before its consumer.
2. Add `typeof Implementation` as the third type argument.
3. Put the dependency keys in the constructor parameter order.
4. Add one key for each required parameter.
5. Remove keys that do not have a constructor parameter.
6. Use a key whose service type is assignable to the parameter type.

Optional constructor parameters accept zero or one matching key. Rest parameters
accept zero or more matching keys. A dependency list can match any public
constructor overload. In the three-type-argument form, every public constructor
overload must return a service that is assignable to the explicit interface type.

TypeScript uses structural types for this check. Services with the same structure
are compatible even when they use different class names.

## Use inference

You can omit all explicit type arguments. Kizuna then infers the implementation
constructor and checks its dependencies:

```typescript
const builder = new ContainerBuilder()
  .registerSingleton('logger', ConsoleLogger)
  .registerSingleton('config', AppConfig)
  .registerScopedInterface('email', EmailService, 'logger', 'config');
```

In this form, `container.get('email')` returns `EmailService`. Use all three type
arguments when the provider must return the interface type.

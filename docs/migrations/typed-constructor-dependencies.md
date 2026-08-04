# Typed constructor dependency keys

Kizuna now checks concrete constructor dependency keys during TypeScript compilation.

This change affects these methods:

- `registerSingleton`
- `registerScoped`
- `registerTransient`
- `addSingleton`
- `addScoped`
- `addTransient`

Each dependency key must identify a registered service. The service type must match the constructor parameter at the same position.

Register each dependency before you register its consumer. TypeScript uses the current builder registry for the check.

## Migration

This registration compiled before the change, but it supplied the dependencies in the wrong order:

```typescript
class Service {
  constructor(readonly logger: Logger, readonly config: Config) {}
}

const builder = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingleton('config', Config)
  .registerScoped('service', Service, 'config', 'logger');
```

Use keys that match the constructor parameter order:

```typescript
const builder = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingleton('config', Config)
  .registerScoped('service', Service, 'logger', 'config');
```

If TypeScript reports an error, make these changes:

1. Register each dependency before its consumer.
2. Put the dependency keys in the constructor parameter order.
3. Add one key for each required parameter.
4. Remove keys that do not have a constructor parameter.
5. Use a key whose service type is assignable to the parameter type.

Optional constructor parameters accept zero or one matching key. Rest parameters accept zero or more matching keys.

TypeScript uses structural types for this check. Services with the same structure are compatible even when they use different class names.

The second generic argument now represents the constructor type. Remove explicit instance-type arguments and use inference:

```typescript
// Before
builder.registerSingleton<'service', Service>('service', Service);

// After
builder.registerSingleton('service', Service);
```

If inference is not possible, use `typeof Service` as the second generic argument.

Interface registration methods are not part of this change. Their explicit interface type continues to define the provider result.

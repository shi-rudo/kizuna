# Registration Patterns

Kizuna has three registration patterns, each available in three lifecycles (9 methods total). The pattern controls how the service is created. The lifecycle controls when instances are reused.

## Decision guide

| Situation | Pattern | Example |
| --- | --- | --- |
| Class with constructor dependencies | Constructor | `registerSingleton('svc', Svc, 'dep1', 'dep2')` |
| Resolved type should be an interface/abstraction | Interface | `registerSingletonInterface<IFoo>('foo', FooImpl, 'dep')` |
| Needs runtime logic, returns primitive, or needs provider | Factory | `registerSingletonFactory('cfg', (p) => ({ ... }))` |
| Default choice when unsure | Constructor | Shorter, explicit deps, works with validate() |

## Constructor registration

The most common pattern. Dependencies are declared as trailing string arguments that match constructor parameter names.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

class Logger {
  log(msg: string) { console.log(msg); }
}

class UserService {
  constructor(private logger: Logger, private config: AppConfig) {}
}

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingleton('config', AppConfig)
  .registerScoped('userService', UserService, 'logger', 'config')
  .build();
```

Dependencies are visible to `validate()` and checked for existence and circular references.

## Interface registration

Identical to constructor registration at runtime. The only difference: the generic type parameter sets the resolved type.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

interface ICache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

class RedisCache implements ICache {
  constructor(private logger: Logger) {}
  get(key: string) { return undefined; }
  set(key: string, value: string) {}
}

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingletonInterface<ICache>('cache', RedisCache, 'logger')
  .build();

const cache = container.get('cache'); // Type: ICache (not RedisCache)
```

Use this only when you want the container to return an interface type. If the resolved type equals the concrete class, use plain `registerSingleton`.

## Factory registration

Factories receive a `TypeSafeServiceLocator<TRegistry>` with full type inference on `provider.get()`.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingletonFactory('config', () => ({
    dbUrl: process.env.DATABASE_URL ?? 'postgres://localhost/dev',
    debug: process.env.NODE_ENV !== 'production',
  }))
  .registerSingletonFactory('database', (provider) => {
    const config = provider.get('config');
    const logger = provider.get('logger');
    logger.log(`Connecting to ${config.dbUrl}`);
    return new DatabaseConnection(config.dbUrl);
  })
  .build();
```

Factory dependencies are hidden from `validate()`. Prefer constructor registration when possible.

## All nine methods

| Lifecycle | Constructor | Interface | Factory |
| --- | --- | --- | --- |
| Singleton | `registerSingleton` | `registerSingletonInterface` | `registerSingletonFactory` |
| Scoped | `registerScoped` | `registerScopedInterface` | `registerScopedFactory` |
| Transient | `registerTransient` | `registerTransientInterface` | `registerTransientFactory` |

All methods return a new `ContainerBuilder` with an updated type registry, enabling chained registration with cumulative type inference.

## The Factory<T> type is stale

`types.ts` exports `Factory<T>` as `(serviceProvider: ServiceLocator) => T`. The actual factory parameter type on `ContainerBuilder` is `(provider: TypeSafeServiceLocator<TRegistry>) => T`. Do not import or use `Factory<T>` — let TypeScript infer the type from the registration method.

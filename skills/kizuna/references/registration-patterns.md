# Registration Patterns

Kizuna has two registration modes: **single-registration** (`register*`) and **multi-registration** (`add*`). Single-registration has three patterns (constructor, interface, factory) across three lifecycles (9 methods). Multi-registration has two patterns (constructor, factory) across three lifecycles (6 methods). Total: 15 registration methods.

## Decision guide

| Situation | Pattern | Example |
| --- | --- | --- |
| Class with constructor dependencies | Constructor | `registerSingleton('svc', Svc, 'dep1', 'dep2')` |
| Resolved type must be an interface or abstraction | Interface | `registerSingletonInterface(Foo, FooImpl, 'dep')` |
| Needs runtime logic, returns primitive, or needs provider | Factory | `registerSingletonFactory('cfg', (p) => ({ ... }))` |
| Multiple implementations under one key | Multi-reg | `addSingleton('plugins', PluginA)` then `addSingleton('plugins', PluginB)` |
| Singleton owned by another container | Borrow | `borrowSingletonFrom(shared, 'logger')` |
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

Interface registration uses the same runtime process as constructor registration. The interface token sets the service key and the resolved type.

```typescript
import { ContainerBuilder, interfaceToken } from '@shirudo/kizuna';

interface ICache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

class RedisCache implements ICache {
  constructor(private logger: Logger) {}
  get(key: string) { return undefined; }
  set(key: string, value: string) {}
}

const Cache = interfaceToken<ICache>()('cache');

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingletonInterface(Cache, RedisCache, 'logger')
  .build();

const cache = container.get(Cache); // Type: ICache (not RedisCache)
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

## Borrowed singleton

Use `borrowSingletonFrom()` to import one singleton without taking ownership.
The method accepts a fixed string key or a registered interface token.

```typescript
const shared = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .build();

const domain = new ContainerBuilder()
  .borrowSingletonFrom(shared, 'logger')
  .registerScoped('userService', UserService, 'logger')
  .build();
```

The source must be the root container that registered and owns the singleton.
You cannot borrow scoped, transient, multi-service, or borrowed registrations.
A scope cannot lend a singleton. The source must outlive each borrower and its
scopes.

Dispose the domain container before you dispose `shared`.

The source owns the value and runs its cleanup hook. The borrowed key remains a
declared dependency in the domain container.

## Multi-registration (add* / getAll)

Use `add*()` to register multiple implementations under the same key. Resolve all of them with `getAll()`.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

class ConsoleLogger {
  log(msg: string) { console.log(msg); }
}

class FileLogger {
  log(msg: string) { /* write to file */ }
}

const container = new ContainerBuilder()
  .addSingleton('loggers', ConsoleLogger)
  .addSingleton('loggers', FileLogger)
  .build();

const loggers = container.getAll('loggers'); // Type: (ConsoleLogger | FileLogger)[]
loggers.forEach(l => l.log('Hello'));
```

**Key rules:**
- `add*()` and `register*()` cannot share the same key — pick one pattern per key
- `getAll()` returns an array; `get()` on a multi-key also returns the array
- Each implementation can have its own lifecycle (e.g., mix `addSingleton` + `addScoped` under one key)
- `validate()` checks multi-registration dependencies for missing services and circular deps
- Factory variants available: `addSingletonFactory`, `addScopedFactory`, `addTransientFactory`

**Use cases:** plugin systems, middleware pipelines, event handlers, validation rule sets, composite loggers.

## All registration methods

### Single-registration (register*)

| Lifecycle | Constructor | Interface | Factory |
| --- | --- | --- | --- |
| Singleton | `registerSingleton` | `registerSingletonInterface` | `registerSingletonFactory` |
| Scoped | `registerScoped` | `registerScopedInterface` | `registerScopedFactory` |
| Transient | `registerTransient` | `registerTransientInterface` | `registerTransientFactory` |

### Multi-registration (add*)

| Lifecycle | Constructor | Factory |
| --- | --- | --- |
| Singleton | `addSingleton` | `addSingletonFactory` |
| Scoped | `addScoped` | `addScopedFactory` |
| Transient | `addTransient` | `addTransientFactory` |

All methods return a new `ContainerBuilder` with an updated type registry, enabling chained registration with cumulative type inference.

## Factory types are inferred

The package root does not export a factory helper type. Let TypeScript infer the
type from the registration method. The provider parameter uses the registry that
exists at that point in the builder chain.

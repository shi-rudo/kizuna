# Registration Patterns

Kizuna has two registration modes: **single-registration** (`register*`) and **multi-registration** (`add*`). Single-registration has three patterns (constructor, interface, factory) across three lifecycles (9 methods). Multi-registration has two patterns (constructor, factory) across three lifecycles (6 methods). Total: 15 registration methods.

## Decision guide

| Situation | Pattern | Example |
| --- | --- | --- |
| Class with constructor dependencies | Constructor | `registerSingleton('svc', Svc, 'dep1', 'dep2')` |
| Resolved type must be an interface or abstraction | Interface | `registerSingletonInterface(Foo, FooImpl, 'dep')` |
| Needs runtime logic, returns primitive, or needs the container | Factory | `registerSingletonFactory('cfg', (p) => ({ ... }))` |
| Multiple implementations under one key | Multi-reg | `addSingleton('plugins', PluginA)` then `addSingleton('plugins', PluginB)` |
| Singleton owned by another container | Borrow | `borrowSingletonFrom(shared, 'logger')` |
| Default choice when unsure | Constructor | Short, explicit dependencies, and full graph validation |

## Constructor registration

The most common pattern uses trailing dependency keys. TypeScript matches each
key type with the constructor parameter at the same position.

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

Factories receive a `ServiceContainer<TRegistry>` with full type inference on `container.get()`.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingletonFactory('config', () => ({
    dbUrl: process.env.DATABASE_URL ?? 'postgres://localhost/dev',
    debug: process.env.NODE_ENV !== 'production',
  }))
  .registerSingletonFactory('database', (container) => {
    const config = container.get('config');
    const logger = container.get('logger');
    logger.log(`Connecting to ${config.dbUrl}`);
    return new DatabaseConnection(config.dbUrl);
  }, 'config', 'logger')
  .build();
```

The final keys declare the factory lookups. Validation and cleanup order use
these graph edges. An undeclared container lookup stays invisible.

## Borrowed singleton

Borrowing fits an application that uses separate containers inside one process.
A shared root container owns long-lived infrastructure. A domain container
imports only the instances that its services need.

Kizuna does not enforce domain boundaries. Separate registries restrict
resolution to registered keys. Application code controls imports,
cross-domain calls, and data ownership.

Typical shared services include loggers, metrics collectors, configuration
readers, and connection pools. Borrowing prevents duplicate resources and keeps
the domain registry small.

Borrowing creates a lifetime dependency. The source must outlive each borrower.
When most registrations are shared, a single container is clearer. Borrowing
is not suitable for request state or communication between processes.

`borrowSingletonFrom()` accepts a fixed string key or a registered interface
token.

```typescript
import { ContainerBuilder, interfaceToken } from '@shirudo/kizuna';

interface Metrics {
  increment(name: string): void;
}

const Metrics = interfaceToken<Metrics>()('metrics');

const sharedContainer = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingletonInterface(Metrics, MetricsCollector)
  .build();

const domainContainer = new ContainerBuilder()
  .borrowSingletonFrom(sharedContainer, 'logger')
  .borrowSingletonFrom(sharedContainer, Metrics)
  .registerScoped('userService', UserService, 'logger', Metrics)
  .build();
```

The source must be the root container that registered and owns the singleton.
You cannot borrow scoped, transient, multi-service, or borrowed registrations.
A scope cannot lend a singleton. The source must outlive each borrower and its
scopes.

Dispose all borrowers and their scopes first. Then dispose the source.

The source owns the value and runs its cleanup hook. The borrowed key remains a
declared dependency. Validation can see this dependency.

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
- `getAll()` resolves only `add*()` keys; `get()` resolves only `register*()` keys and interface tokens. The wrong method fails at compile time and at runtime.
- A constructor dependency on an `add*()` key receives all services as an array. Factories call `getAll()`.
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

## Inspect registrations

```typescript
const builder = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingleton('database', DatabaseService, 'logger')
  .registerScoped('userService', UserService, 'database', 'logger');

builder.getRegisteredServiceNames(); // ['logger', 'database', 'userService']
builder.isRegistered('database'); // true
builder.keyCount; // 3 (a multi-registration key counts once)
builder.registrationCount; // 3 (each add*() call counts)
```

Re-registering an existing `register*()` key throws. Create a new builder when
you need a different registration set. This rule keeps the inferred registry in
sync with runtime registrations.

## Factory types are inferred

The package root does not export a factory helper type. Let TypeScript infer the
type from the registration method. The container parameter uses the registry that
exists at that point in the builder chain.

---
name: kizuna
description: >
  Use @shirudo/kizuna to wire up services with type-safe dependency injection.
  Covers ContainerBuilder, registerSingleton, registerSingletonInterface,
  registerSingletonFactory, registerScoped, registerTransient, addSingleton,
  addScoped, addTransient, addSingletonFactory, addScopedFactory,
  addTransientFactory, borrowSingletonFrom, build(), validate(), get(), getAll(), startScope(),
  dispose(), disposeAsync(), Symbol.dispose, Symbol.asyncDispose,
  getRegisteredServiceNames(), TypeSafeServiceLocator,
  disableStrictParameterValidation, CircularDependencyError.
  Activate when registering services, choosing lifecycles, managing request
  scopes, registering multiple implementations under one key, debugging
  validation errors, testing with mock containers, deploying to edge
  runtimes (Cloudflare Workers, Vercel Edge), or integrating with web
  frameworks.
type: core
library: kizuna
library_version: "1.0.0-rc.9"
sources:
  - "shi-rudo/kizuna:src/api/container-builder.ts"
  - "shi-rudo/kizuna:src/api/base-container-builder.ts"
  - "shi-rudo/kizuna:src/api/service-provider.ts"
  - "shi-rudo/kizuna:src/api/contracts/interfaces.ts"
  - "shi-rudo/kizuna:src/api/contracts/types.ts"
  - "shi-rudo/kizuna:src/core/scopes/singleton.ts"
  - "shi-rudo/kizuna:src/core/scopes/scoped.ts"
  - "shi-rudo/kizuna:src/core/scopes/transient.ts"
  - "shi-rudo/kizuna:src/core/scopes/borrowed-singleton.ts"
  - "shi-rudo/kizuna:src/core/services/service-wrapper.ts"
  - "shi-rudo/kizuna:src/core/services/async-dispose.ts"
  - "shi-rudo/kizuna:README.md"
---

# Kizuna — Dependency Injection

Kizuna is a zero-dependency, type-safe DI container for TypeScript. Services are plain classes — no decorators, no base classes. The `ContainerBuilder` provides a fluent API with three registration patterns (constructor, interface, factory) across three lifecycles (singleton, scoped, transient), plus multi-registration for plugin/middleware patterns. All type inference flows through the builder chain.

## Setup

Use TypeScript 5.0 or newer.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

class Logger {
  log(msg: string) { console.log(msg); }
}

class UserRepository {
  constructor(private logger: Logger) {}
  findById(id: string) { this.logger.log(`Finding user ${id}`); }
}

const builder = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerScoped('userRepository', UserRepository, 'logger');

// Always validate before building
const issues = builder.validate();
if (issues.length > 0) {
  throw new Error(`Container errors:\n${issues.join('\n')}`);
}

const container = builder.build();

// Resolve services — return types are fully inferred
const repo = container.get('userRepository'); // Type: UserRepository
```

## Core Patterns

### Register against an interface

Use `registerSingletonInterface` when the resolved type must be an abstraction. An interface token stores the service key and its TypeScript type.

```typescript
import { ContainerBuilder, interfaceToken } from '@shirudo/kizuna';

interface IEmailService {
  send(to: string, body: string): Promise<void>;
}

class SmtpEmailService implements IEmailService {
  constructor(private logger: Logger) {}
  async send(to: string, body: string) { /* ... */ }
}

const EmailService = interfaceToken<IEmailService>()('emailService');

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingletonInterface(EmailService, SmtpEmailService, 'logger')
  .build();

const email = container.get(EmailService); // Type: IEmailService
```

### Register a factory for config or conditional logic

Use factories when construction needs runtime logic, returns primitives, or requires the service provider.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

const container = new ContainerBuilder()
  .registerSingletonFactory('config', () => ({
    dbUrl: process.env.DATABASE_URL ?? 'postgres://localhost:5432/dev',
    port: parseInt(process.env.PORT ?? '3000', 10),
  }))
  .registerSingletonFactory('database', (provider) => {
    const config = provider.get('config'); // Type: { dbUrl: string; port: number }
    return new DatabaseConnection(config.dbUrl);
  })
  .build();
```

### Multi-registration with add* / getAll

Use `add*()` methods to register multiple implementations under the same key. Resolve all of them with `getAll()`. This is the pattern for plugin systems, middleware pipelines, event handlers, and validation rule sets.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

interface Validator {
  validate(input: string): boolean;
}

class LengthValidator implements Validator {
  validate(input: string) { return input.length >= 3; }
}

class FormatValidator implements Validator {
  validate(input: string) { return /^[a-z]+$/.test(input); }
}

const container = new ContainerBuilder()
  .addSingleton('validators', LengthValidator)
  .addSingleton('validators', FormatValidator)
  .build();

const validators = container.getAll('validators'); // Type: (LengthValidator | FormatValidator)[]
const allValid = validators.every(v => v.validate('hello')); // true
```

**Key rules:**
- `add*()` and `register*()` cannot share the same key — pick one pattern per key
- `getAll()` returns an array; `get()` on a multi-key also returns the array
- Each implementation can have its own lifecycle (mix singleton + scoped under one key)
- Factory variants available: `addSingletonFactory`, `addScopedFactory`, `addTransientFactory`
- `validate()` checks multi-registration dependencies, circular deps, and captive dependencies

### Borrow a singleton from another container

Borrowing fits an application that uses separate containers inside one process.
A shared root container owns long-lived infrastructure. A domain container
imports only the instances that its services need.

Typical shared services include loggers, metrics collectors, configuration
readers, and connection pools. Borrowing prevents duplicate resources and keeps
the domain registry small.

Borrowing also creates a lifetime dependency. The shared root container must
outlive each borrower. When most registrations are shared, a single container
is clearer.

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
A scope cannot lend a singleton. Dispose all borrowers and their scopes first.
Then dispose the source.

The borrowed key is part of the borrower dependency graph. Validation can see
the dependency. The source container still controls cleanup of the value.

### Request scoping for web servers

Create a scope per request. Scoped services share one instance within the scope. Singletons are shared across all scopes.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import express from 'express';

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerScoped('userService', UserService, 'logger')
  .registerScopedFactory('requestId', () => crypto.randomUUID())
  .build();

const app = express();

app.use((req, res, next) => {
  req.scope = container.startScope();
  res.on('finish', () => req.scope.dispose());
  next();
});

app.get('/users/:id', (req, res) => {
  const userService = req.scope.get('userService');
  res.json(userService.findById(req.params.id));
});
```

### Validate before building

`build()` does NOT validate. Call `validate()` explicitly to catch missing dependencies, circular dependencies, captive dependencies (singleton depending on scoped), and parameter name mismatches at startup.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

const builder = new ContainerBuilder()
  .registerSingleton('userService', UserService, 'database', 'logger');

const issues = builder.validate();
// [
//   "Service 'userService' depends on unregistered service 'database'",
//   "Service 'userService' depends on unregistered service 'logger'"
// ]
```

### Disposal

Kizuna cleans only values that it owns and tracks.

| Value | Cleanup owner |
|---|---|
| Singleton | The root container that registered it |
| Scoped | The container or scope that resolved it |
| Transient | The caller. Kizuna does not track transient values. |
| Borrowed singleton | The source root container |

`disposeAsync()` is the default for application shutdown. It supports
synchronous hooks and waits for asynchronous hooks. The `dispose()` method is
suitable only when all owned services have synchronous cleanup.

```typescript
class DatabasePool {
  async dispose() { await this.pool.end(); } // returns Promise — needs disposeAsync
}

const container = builder.build();
const pool = container.get('dbPool');

try {
  // ...use the container...
} finally {
  await container.disposeAsync();
}
```

Each value uses at most one cleanup hook. Kizuna uses these priorities:

| Container API | Hook priority |
|---|---|
| `disposeAsync()` | `[Symbol.asyncDispose]` → `[Symbol.dispose]` → `dispose()` |
| `dispose()` | `[Symbol.dispose]` → `dispose()` → `[Symbol.asyncDispose]` |

The async API waits for the selected hook. If the sync API receives a Promise,
cleanup starts, but the API cannot wait for it. The `DisposalError` then
contains a `TypeError`.

Kizuna gets cleanup order from declared registration dependencies. It cleans a
consumer before its dependencies. The async API runs independent graph branches
in parallel. Their relative completion order is not defined.

For example, Kizuna cleans `UserService`, `UserRepository`, and `DatabasePool`
in that order when each service depends on the next service.

Factory lookups do not declare dependency keys. Therefore, these lookups do not
define cleanup order. When cleanup order is necessary, use a constructor
registration with explicit dependency keys.

Both APIs attempt all cleanup operations. They report all failures in one
`DisposalError`. The `errors` property contains the original errors. The
`failures` property identifies the service key, lifetime, and cleanup operation.
Kizuna does not write cleanup errors to the console.

Singleton and scoped factories can return Promises. The async API waits for a
stored Promise and cleans its resolved value. The container does not track
transient values or transient Promises.

If a stored Promise rejects before disposal, the lifecycle removes it from the
cache. The next resolution invokes the factory again. Consumers must handle the
original rejection.

The container clears its internal state before it reports errors. Later calls
to `get()`, `getAll()`, or `startScope()` fail. A second disposal call is a
no-op.

Kizuna does not track child scopes. Dispose each scope before its root
container. Dispose each borrower before the source root container.

TC39 resource management uses the same APIs:

```typescript
{
  await using scope = container.startScope();
  // ...use scope...
} // scope.disposeAsync() called automatically on block exit
```

`await using` requires TypeScript 5.2 or newer and a compatible runtime. On an
older runtime, use `try` and `finally` with `disposeAsync()`.

## Container Inspection

```typescript
const builder = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingleton('database', DatabaseService, 'logger')
  .registerScoped('userService', UserService, 'database', 'logger');

// Inspect registered services
builder.getRegisteredServiceNames(); // ['logger', 'database', 'userService']
builder.isRegistered('database'); // true
builder.count; // 3
```

Re-registering an existing `register*()` key throws. Create a new builder when
you need a different registration set. This rule keeps the inferred registry in
sync with runtime registrations.

## Common Mistakes

### CRITICAL Omitting the mandatory string key

Wrong:

```typescript
new ContainerBuilder()
  .registerSingleton(UserService)
  .build();
```

Correct:

```typescript
new ContainerBuilder()
  .registerSingleton('userService', UserService)
  .build();
```

Every registration method (including `add*`) requires a string key as the first argument. There is no overload that accepts only a class. Agents trained on tsyringe, inversify, or NestJS generate the keyless form.

Source: container-builder.ts method signatures

### CRITICAL Assuming build() validates

Wrong:

```typescript
const container = new ContainerBuilder()
  .registerSingleton('userService', UserService, 'database')
  .build();
// 'database' is not registered — no error at build time
// Explodes when container.get('userService') is called
```

Correct:

```typescript
const builder = new ContainerBuilder()
  .registerSingleton('userService', UserService, 'database');
const issues = builder.validate();
if (issues.length > 0) throw new Error(issues.join('\n'));
const container = builder.build();
```

`build()` creates the service locator without checking for missing dependencies,
circular dependencies, or parameter mismatches. Errors occur during resolution.
The first resolution that touches a cycle throws `CircularDependencyError`. Its
message and `chain` property show the full path.

Source: container-builder.ts, service-provider.ts

### CRITICAL Captive dependency — singleton holds scoped service

Wrong:

```typescript
new ContainerBuilder()
  .registerScoped('requestContext', RequestContext)
  .registerSingleton('userService', UserService, 'requestContext')
  .build();
```

Correct:

```typescript
new ContainerBuilder()
  .registerScoped('requestContext', RequestContext)
  .registerScoped('userService', UserService, 'requestContext')
  .build();
```

A singleton captures the first scope's instance and holds it forever — after that scope is disposed, every consumer sees the disposed instance. `validate()` reports this as a captive dependency (`Service 'userService' is a singleton but depends on scoped service 'requestContext' (captive dependency): ...`) — one more reason to always run it before `build()`.

Source: base-container-builder.ts validate()

### HIGH Using factories when constructor registration works

Wrong:

```typescript
.registerSingletonFactory('userService', (provider) => {
  const db = provider.get('database');
  const logger = provider.get('logger');
  return new UserService(db, logger);
})
```

Correct:

```typescript
.registerSingleton('userService', UserService, 'database', 'logger')
```

Constructor registration is shorter, declares dependencies explicitly for `validate()`, and lets Kizuna handle the wiring. Factories hide dependencies from validation.

Source: maintainer interview

### HIGH Re-registering a shared singleton in another container

Wrong:

```typescript
const domainContainer = new ContainerBuilder()
  .registerSingletonFactory('logger', () => sharedContainer.get('logger'))
  .build();
```

Correct:

```typescript
const domainContainer = new ContainerBuilder()
  .borrowSingletonFrom(sharedContainer, 'logger')
  .build();
```

The factory registration gives the domain container disposal ownership over
the returned value. This can run the same cleanup hook more than once. Borrowing
keeps ownership in the source container.

### HIGH Mixing add* and register* on the same key

Wrong:

```typescript
new ContainerBuilder()
  .registerSingleton('handler', DefaultHandler)
  .addSingleton('handler', ExtraHandler) // throws at build time
  .build();
```

Correct:

```typescript
// Use ONLY add* for multi-registration keys
new ContainerBuilder()
  .addSingleton('handlers', DefaultHandler)
  .addSingleton('handlers', ExtraHandler)
  .build();

// Use register* for single-registration keys
new ContainerBuilder()
  .registerSingleton('handler', DefaultHandler)
  .build();
```

A key must be either single-registration (`register*`) or multi-registration (`add*`). Mixing them on the same key throws an error.

Source: base-container-builder.ts

### HIGH Using registerSingletonInterface unnecessarily

Wrong:

```typescript
const LoggerService = interfaceToken<Logger>()('logger');
new ContainerBuilder()
  .registerSingletonInterface(LoggerService, ConsoleLogger)
```

Correct:

```typescript
// Use plain registerSingleton when resolved type = concrete class
new ContainerBuilder()
  .registerSingleton('logger', ConsoleLogger)

// Use Interface ONLY to widen the resolved type to an abstraction
const LoggerService = interfaceToken<ILogger>()('logger');
new ContainerBuilder()
  .registerSingletonInterface(LoggerService, ConsoleLogger)
```

The interface variant stores the interface type in a token. Both variants use the same registration process at runtime.

Source: container-builder.ts:138-147

### HIGH Adding decorators that do not exist

Wrong:

```typescript
import { Injectable, Inject } from '@shirudo/kizuna';

@Injectable()
class UserService {
  constructor(@Inject('database') private db: Database) {}
}
```

Correct:

```typescript
class UserService {
  constructor(private db: Database) {}
}

new ContainerBuilder()
  .registerSingleton('userService', UserService, 'database')
  .build();
```

Kizuna does not use decorators. Services are plain classes. The `@Injectable` and `@Inject` imports do not exist.

Source: package exports — no decorator exports

### HIGH Parameter name does not match dependency key

Wrong:

```typescript
class UserService {
  constructor(private db: DatabaseConnection) {}
}

new ContainerBuilder()
  .registerSingleton('DatabaseConnection', DatabaseConnection)
  .registerSingleton('UserService', UserService, 'DatabaseConnection')
  // validate() warns: param 0 is 'db' but 'DatabaseConnection' provided
```

Correct:

```typescript
new ContainerBuilder()
  .registerSingleton('db', DatabaseConnection)
  .registerSingleton('UserService', UserService, 'db')
```

Strict parameter validation (enabled by default in development) checks that dependency keys match constructor parameter names positionally. Pick one naming convention and stick with it.

The check is **auto-disabled when `NODE_ENV === "production"`** (or when `process` is unavailable, e.g. in Cloudflare Workers / Vercel Edge) because bundler minification mangles parameter names into `a`, `b`, `c` — running the check there would produce false positives. No opt-out needed for production builds. Call `.disableStrictParameterValidation()` only if you also want to skip the check in development.

Source: `BaseContainerBuilder.validate()` in base-container-builder.ts

### HIGH Importing internal factory types

Wrong:

```typescript
import { Factory } from '@shirudo/kizuna';
const myFactory: Factory<UserService> = (provider) => {
  return new UserService(provider.get('database'));
};
```

Correct:

```typescript
// Let TypeScript infer the factory type from the registration method
.registerSingletonFactory('userService', (provider) => {
  const db = provider.get('database'); // Type-safe!
  return new UserService(db);
})
```

The package root does not export `Factory`. Let TypeScript infer the type from
the registration method. The inferred provider uses the current typed registry.

Source: types.ts vs container-builder.ts factory signatures

### HIGH Using non-existent APIs from examples

Wrong:

```text
// These methods do not exist on ContainerBuilder
.registerInterface<IDatabase>('db', PostgresDatabase, 'logger')
.registerFactory('config', () => ({ port: 3000 }))

// These methods do not exist on TypeSafeServiceLocator
scope.registerInstance('requestId', id);
scope.reset();
```

Correct:

```typescript
// All registration methods require a lifecycle prefix
const Database = interfaceToken<IDatabase>()('db');
new ContainerBuilder()
  .registerSingletonInterface(Database, PostgresDatabase, 'logger')
  .registerSingletonFactory('config', () => ({ port: 3000 }))

// Scopes are read-only — use scoped factories for per-request values
new ContainerBuilder()
  .registerScopedFactory('requestId', () => crypto.randomUUID())
```

Old examples used `registerInterface()`, `registerFactory()`,
`registerInstance()`, and `scope.reset()`. These methods are not public APIs.

### HIGH Using get() instead of getAll() for multi-registration keys

Wrong:

```typescript
const container = new ContainerBuilder()
  .addSingleton('validators', LengthValidator)
  .addSingleton('validators', FormatValidator)
  .build();

const validator = container.get('validators');
// Returns the ARRAY, not a single validator — confusing
```

Correct:

```typescript
const validators = container.getAll('validators');
// Explicitly returns Validator[] — intent is clear
```

`get()` on a multi-registration key returns the array (same as `getAll()`), but `getAll()` communicates intent. For single-registration keys, `getAll()` wraps the result in a single-element array.

Source: service-provider.ts:40-62

## References

- [Registration patterns — constructor vs interface vs factory](references/registration-patterns.md)
- [Lifecycle guide — singleton, scoped, transient, captive dependency](references/lifecycle-guide.md)
- [Validation errors — validate() contract, debugging, parameter names](references/validation-errors.md)
- [Scoping and middleware — Express, Hono, Fastify patterns](references/scoping-and-middleware.md)
- [Testing — test containers, stubs, scope isolation](references/testing.md)
- [Next.js integration — scoping without middleware](references/nextjs.md)
- [TanStack Start integration — loader and action scoping](references/tanstack-start.md)
- [Edge runtimes — Cloudflare Workers, Vercel Edge patterns](references/edge-runtimes.md)
- [Migration — from manual wiring, from decorator-based DI](references/migration.md)

---
name: kizuna
description: >
  Use @shirudo/kizuna to wire up services with type-safe dependency injection.
  Covers ContainerBuilder, registerSingleton, registerSingletonInterface,
  registerSingletonFactory, registerScoped, registerTransient, addSingleton,
  addScoped, addTransient, addSingletonFactory, addScopedFactory,
  addTransientFactory, build(), validate(), get(), getAll(), startScope(),
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
library_version: "1.0.0-rc.3"
sources:
  - "shi-rudo/kizuna:src/api/container-builder.ts"
  - "shi-rudo/kizuna:src/api/base-container-builder.ts"
  - "shi-rudo/kizuna:src/api/service-provider.ts"
  - "shi-rudo/kizuna:src/api/contracts/interfaces.ts"
  - "shi-rudo/kizuna:src/api/contracts/types.ts"
  - "shi-rudo/kizuna:src/core/scopes/singleton.ts"
  - "shi-rudo/kizuna:src/core/scopes/scoped.ts"
  - "shi-rudo/kizuna:src/core/scopes/transient.ts"
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

Two disposal APIs:
- `container.dispose()` — synchronous. Invokes each instance's sync dispose hook (see priority below). It cannot await Promises.
- `container.disposeAsync()` — awaits service-owned async cleanup. Waits for all consumers before it starts dependency cleanup.

Both APIs process consumers before their declared dependencies. Sync disposal keeps registration order within each disposal layer.

Independent cleanup can run in parallel during `disposeAsync()`. Its order depends on completion timing.

Multi-registration keys include all services under that key. Factory lookups do not affect disposal order because factories do not declare dependency keys.

Kizuna checks object and function values from singleton and scoped factories for cleanup hooks.

Singleton and scoped factories can return Promise values. `disposeAsync()`
waits for each stored Promise and cleans its resolved value. Transient values
are not tracked or cleaned.

An active singleton or scoped lifecycle removes a rejected Promise from its
cache. The next `get()` or `getAll()` call invokes only the failed factory again.
The lifecycle does not retry automatically.

If disposal starts before the Promise settles, the lifecycle keeps ownership.
`disposeAsync()` reports a later rejection in its `DisposalError`.

Plus TC39 explicit-resource-management hooks: `[Symbol.dispose]` (alias for `dispose()`) and `[Symbol.asyncDispose]` (alias for `disposeAsync()`) — enable `using` and `await using` syntax.

Both APIs attempt all cleanup operations. `dispose()` throws one
`DisposalError` after sync cleanup completes. `disposeAsync()` rejects with one
`DisposalError` after all cleanup settles. The `errors` property contains the
original errors. Kizuna does not write cleanup errors to the console.

`DisposalError` extends the JavaScript `AggregateError` class. It reports
multiple cleanup errors and does not represent a domain aggregate.

For each lifecycle, disposal does:
- **Singleton**: Invokes the instance's dispose hook (sync or async path, see priority below) if present, then marks lifecycle as permanently disposed
- **Scoped**: Same on a per-scope basis, clears instance reference
- **Transient**: Clears factory reference (individual instances are not tracked)

After disposal, `get()`, `getAll()`, and `startScope()` throw `"Cannot access services from a disposed container"`. Disposal is idempotent — calling it (or `disposeAsync`) twice is safe.

```typescript
class DatabasePool {
  async dispose() { await this.pool.end(); } // returns Promise — needs disposeAsync
}

const container = builder.build();
const pool = container.get('dbPool');

// Pick ONE of the patterns below — they are alternatives, not steps.
// Once disposed, a container cannot be used again.

// Option A — Sync. Fine only for purely-synchronous services.
container.dispose();

// Option B — Async. Waits for consumers before their dependencies.
//            Use this whenever any service has async cleanup.
await container.disposeAsync();

// Option C — TC39 explicit resource management (scoped to a block).
//            Best for per-request scopes; the container itself can
//            still be disposed separately at shutdown.
{
  await using scope = container.startScope();
  // ...use scope...
} // scope.disposeAsync() called automatically on block exit
```

> **Note:** `await using` requires TypeScript ≥ 5.2 and a modern V8 runtime (Node ≥ 22, Bun, Deno, Cloudflare Workers, Vercel Edge). On older Node versions use the explicit `try/finally + await disposeAsync()` pattern.

**Per-API resolution rules (exactly one hook is invoked per instance):**
- `disposeAsync()` picks the instance's cleanup method by priority: `[Symbol.asyncDispose]` → `[Symbol.dispose]` → `dispose()`. The first one present is awaited.
- `dispose()` picks the sync cleanup method by priority: `[Symbol.dispose]` → `dispose()` → `[Symbol.asyncDispose]`. The async hook is a last resort. If the selected hook returns a Promise, cleanup starts. The `DisposalError` contains a `TypeError` because `dispose()` cannot wait.

**When sync `dispose()` is wrong:** Use `disposeAsync()` when a service has asynchronous cleanup. Examples include database pools, file handles, and network connections. The sync method starts a Promise-based cleanup but does not await it. The `DisposalError` reports this condition.

This rule also applies when a singleton or scoped factory returns a Promise.
The sync method starts cleanup for its resolved value but cannot wait.

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

```typescript
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

The examples and docs reference `registerInterface()`, `registerFactory()`, `registerInstance()`, and `scope.reset()` as planned features (ADR-003) that were never implemented.

Source: examples/unified-container-example.ts:109,113; docs/concurrency-patterns.md:229,582

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

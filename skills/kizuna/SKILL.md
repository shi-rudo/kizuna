---
name: kizuna
description: >
  Use @shirudo/kizuna to wire up services with type-safe dependency injection.
  Covers ContainerBuilder, registerSingleton, registerSingletonInterface,
  registerSingletonFactory, registerScoped, registerTransient, addSingleton,
  addScoped, addTransient, addSingletonFactory, addScopedFactory,
  addTransientFactory, build(), validate(), get(), getAll(), startScope(),
  dispose(), remove(), getRegisteredServiceNames(), TypeSafeServiceLocator,
  disableStrictParameterValidation.
  Activate when registering services, choosing lifecycles, managing request
  scopes, registering multiple implementations under one key, debugging
  validation errors, testing with mock containers, or integrating with web
  frameworks.
type: core
library: kizuna
library_version: "0.0.15"
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
  - "shi-rudo/kizuna:README.md"
---

# Kizuna — Dependency Injection

Kizuna is a zero-dependency, type-safe DI container for TypeScript. Services are plain classes — no decorators, no base classes. The `ContainerBuilder` provides a fluent API with three registration patterns (constructor, interface, factory) across three lifecycles (singleton, scoped, transient), plus multi-registration for plugin/middleware patterns. All type inference flows through the builder chain.

## Setup

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

Use `registerSingletonInterface` only when you want the resolved type to be an abstraction different from the concrete class. At runtime, both methods do exactly the same thing — the difference is purely in the generic type parameter.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

interface IEmailService {
  send(to: string, body: string): Promise<void>;
}

class SmtpEmailService implements IEmailService {
  constructor(private logger: Logger) {}
  async send(to: string, body: string) { /* ... */ }
}

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingletonInterface<IEmailService>('emailService', SmtpEmailService, 'logger')
  .build();

const email = container.get('emailService'); // Type: IEmailService
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
- `validate()` checks multi-registration dependencies and circular deps

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

`build()` does NOT validate. Call `validate()` explicitly to catch missing dependencies, circular dependencies, and parameter name mismatches at startup.

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

Calling `container.dispose()` disposes all lifecycle managers and their instances:
- **Singleton**: Calls `instance.dispose()` if it exists, then marks lifecycle as permanently disposed
- **Scoped**: Calls `instance.dispose()` if it exists, clears instance reference
- **Transient**: Clears factory reference (individual instances are not tracked)

After disposal, `get()`, `getAll()`, and `startScope()` throw `"Cannot access services from a disposed container"`. Disposal is idempotent — calling it twice is safe.

```typescript
const container = builder.build();
const pool = container.get('dbPool');
// ... use container ...

container.dispose(); // pool.dispose() is called automatically if it exists

// container.get('dbPool'); // throws: Cannot access services from a disposed container
```

## Container Inspection & Modification

```typescript
const builder = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingleton('database', DatabaseService, 'logger')
  .registerScoped('userService', UserService, 'database', 'logger');

// Inspect registered services
builder.getRegisteredServiceNames(); // ['logger', 'database', 'userService']

// Remove a registration (before build)
builder.remove('database'); // returns true
builder.remove('nonExistent'); // returns false

// Validate after removal — catches broken dependencies
builder.validate();
// ["Service 'userService' depends on unregistered service 'database'"]
```

`remove()` works on both single-registration and multi-registration keys. It disposes the removed service wrappers and returns `false` if the key wasn't registered.

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

`build()` creates a ServiceProvider without checking for missing dependencies, circular dependencies, or parameter mismatches. Errors surface at resolution time.

Source: container-builder.ts:392-407

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

A singleton captures the first scope's instance and holds it forever. Subsequent requests see stale state. `validate()` does not check lifecycle mismatches.

Source: maintainer interview

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
// Logger IS the type you want — Interface variant adds nothing
.registerSingletonInterface<Logger>('logger', ConsoleLogger)
```

Correct:

```typescript
// Use plain registerSingleton when resolved type = concrete class
.registerSingleton('logger', ConsoleLogger)
// Use Interface ONLY to widen the resolved type to an abstraction
.registerSingletonInterface<ILogger>('logger', ConsoleLogger)
```

The Interface variants differ only at the type level — they set the generic return type. At runtime, both do exactly the same thing.

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

Strict parameter validation (enabled by default) checks that dependency keys match constructor parameter names positionally. Pick one naming convention and stick with it.

Source: base-container-builder.ts:171-193

### HIGH Importing the stale Factory<T> type

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

`Factory<T>` in types.ts is leftover from the pre-unified API. It references `ServiceLocator` instead of `TypeSafeServiceLocator`, producing type errors. Let TypeScript infer the type from the registration method.

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
.registerSingletonInterface<IDatabase>('db', PostgresDatabase, 'logger')
.registerSingletonFactory('config', () => ({ port: 3000 }))

// Scopes are read-only — use scoped factories for per-request values
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
- [Migration — from manual wiring, from decorator-based DI](references/migration.md)

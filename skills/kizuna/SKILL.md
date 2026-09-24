---
name: kizuna
description: >
  Use @shirudo/kizuna to wire up services with type-safe dependency injection.
  Covers ContainerBuilder, registerSingleton, registerSingletonInterface,
  registerSingletonFactory, registerScoped, registerTransient, addSingleton,
  addScoped, addTransient, addSingletonFactory, addScopedFactory,
  addTransientFactory, borrowSingletonFrom, build(), validate(), get(), getAll(), startScope(),
  dispose(), disposeAsync(), Symbol.dispose, Symbol.asyncDispose,
  getRegisteredServiceNames(), ServiceContainer,
  ContainerValidationError, CircularDependencyError.
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
  - "shi-rudo/kizuna:src/api/container.ts"
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

Kizuna is a zero-dependency, type-safe DI container for TypeScript 5.0 or newer.
Services are plain classes, without decorators or base classes. The
`ContainerBuilder` infers the type of every key through the builder chain.

## Core workflow

1. Register each service with a string key, a lifecycle, and the keys of its
   dependencies.
2. Call `build()`. It validates the dependency graph and throws
   `ContainerValidationError` for missing, circular, and captive dependencies.
3. Resolve with `get()`, or with `getAll()` for a multi-registration key.
4. Start a scope for each request or unit of work, and dispose it at the end.
5. At shutdown, dispose the scopes and borrowers first, then the root container.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

class Logger {
  log(message: string) { console.log(message); }
}

class UserRepository {
  constructor(private logger: Logger) {}
  findById(id: string) { this.logger.log(`Finding user ${id}`); }
}

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerScoped('userRepository', UserRepository, 'logger')
  .build(); // Validates the dependency graph.

const scope = container.startScope();
try {
  scope.get('userRepository').findById('42'); // Type: UserRepository
} finally {
  await scope.disposeAsync();
}

await container.disposeAsync(); // At application shutdown.
```

## Choose a registration

| Need | Registration |
| --- | --- |
| A class with constructor dependencies | `registerSingleton(key, Class, ...dependencyKeys)`, also `registerScoped` and `registerTransient` |
| Resolve an abstraction | `interfaceToken<T>()('key')` with `registerSingletonInterface(token, Class, ...dependencyKeys)`, also the scoped and transient variants |
| Runtime logic, configuration, or primitives | `registerSingletonFactory(key, (container) => value, ...lookupKeys)`, also the scoped and transient variants |
| Several implementations under one key | `addSingleton()`, `addScoped()`, `addTransient()`, or an `add*Factory()` method, resolved with `getAll(key)` |
| A singleton that another root container owns | `borrowSingletonFrom(source, key)` |

| Lifetime | Values |
| --- | --- |
| Singleton | One per root container, shared by all scopes |
| Scoped | One per container or scope that resolves it |
| Transient | A new value on each resolution. Kizuna does not track it, so the caller cleans it up. |

Kizuna cleans up only the values that it owns. The
[ownership table](references/lifecycle-guide.md#ownership) names the owner of
each value, including a borrowed singleton.

## Rules

- Pass a string key as the first argument of every registration method. No
  overload accepts only a class.
- Do not add decorators. `@Injectable` and `@Inject` do not exist.
- Prefer constructor registration. Use a factory only when construction needs
  runtime logic. After the factory, list every key that it looks up. Kizuna
  does not inspect the factory body.
- Use an interface registration only to widen the resolved type to an
  abstraction.
- Use one pattern per key: `register*()` or `add*()`. `get()` resolves only
  `register*()` keys and interface tokens. `getAll()` resolves only `add*()`
  keys.
- Do not let a singleton depend on a scoped service. `build()` rejects this
  captive dependency.
- Keep the default validation. Use `build({ validation: 'deferred' })` only for
  a graph that must stay dynamic.
- Scopes are read-only. Use a scoped factory for a value per request, for
  example `registerScopedFactory('requestId', () => crypto.randomUUID())`.
- Share a singleton between containers with `borrowSingletonFrom()`. Do not
  register it again through a factory, because the second container then runs
  its cleanup too. Kizuna does not enforce domain boundaries.
- Use `disposeAsync()` for shutdown. Use `dispose()` only when every owned
  value has synchronous cleanup.
- Branch on an error class or its `code`, never on the message text.
- Do not import internal types such as `Factory`. Let TypeScript infer them
  from the registration method.
- `registerInterface()`, `registerFactory()`, `registerInstance()`, and
  `scope.reset()` do not exist.

[common-mistakes.md](references/common-mistakes.md) shows the wrong and the
correct code for each rule.

## Find the details

| Task | Reference |
| --- | --- |
| Register with a constructor, an interface token, a factory, or `add*()`; borrow a singleton; inspect a builder | [registration-patterns.md](references/registration-patterns.md) |
| Choose a lifetime; avoid captive dependencies; cleanup ownership, hooks, order, and Promise values | [lifecycle-guide.md](references/lifecycle-guide.md) |
| Read validation issues and runtime error classes | [validation-errors.md](references/validation-errors.md) |
| Scope requests in Express, Hono, Fastify, or NestJS | [scoping-and-middleware.md](references/scoping-and-middleware.md) |
| Scope requests in Next.js | [nextjs.md](references/nextjs.md) |
| Scope loaders and actions in TanStack Start | [tanstack-start.md](references/tanstack-start.md) |
| Deploy to Cloudflare Workers or Vercel Edge | [edge-runtimes.md](references/edge-runtimes.md) |
| Test with stub registrations, scopes, and disposal | [testing.md](references/testing.md) |
| Migrate from manual wiring, tsyringe, inversify, or NestJS | [migration.md](references/migration.md) |
| Check generated code against known mistakes | [common-mistakes.md](references/common-mistakes.md) |

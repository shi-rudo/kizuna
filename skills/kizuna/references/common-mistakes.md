# Common Mistakes

Each entry shows code that agents often generate and the Kizuna form that
replaces it. CRITICAL entries break the build or the lifetime of a value. HIGH
entries produce code that does not compile or hides dependencies.

## Contents

- [CRITICAL Omitting the mandatory string key](#critical-omitting-the-mandatory-string-key)
- [CRITICAL Deferring validation without a dynamic graph](#critical-deferring-validation-without-a-dynamic-graph)
- [CRITICAL Captive dependency — singleton holds scoped service](#critical-captive-dependency--singleton-holds-scoped-service)
- [HIGH Using factories when constructor registration works](#high-using-factories-when-constructor-registration-works)
- [HIGH Re-registering a shared singleton in another container](#high-re-registering-a-shared-singleton-in-another-container)
- [HIGH Mixing add* and register* on the same key](#high-mixing-add-and-register-on-the-same-key)
- [HIGH Using registerSingletonInterface unnecessarily](#high-using-registersingletoninterface-unnecessarily)
- [HIGH Adding decorators that do not exist](#high-adding-decorators-that-do-not-exist)
- [HIGH Factory dependency is not declared](#high-factory-dependency-is-not-declared)
- [HIGH Importing internal factory types](#high-importing-internal-factory-types)
- [HIGH Using non-existent APIs from examples](#high-using-non-existent-apis-from-examples)
- [HIGH Using get() instead of getAll() for multi-registration keys](#high-using-get-instead-of-getall-for-multi-registration-keys)

## CRITICAL Omitting the mandatory string key

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

## CRITICAL Deferring validation without a dynamic graph

Wrong:

```typescript
const container = new ContainerBuilder()
  .registerSingleton('userService', UserService, 'database' as never)
  .build({ validation: 'deferred' });
```

Correct:

```typescript
const container = new ContainerBuilder()
  .registerSingleton('database', Database)
  .registerSingleton('userService', UserService, 'database')
  .build();
```

`build()` validates the graph by default. It throws `ContainerValidationError`
for missing, circular, and captive dependencies.

An undeclared factory cycle stays dynamic. Its first resolution throws
`CircularDependencyError` with the full path.

Source: container-builder.ts, container.ts

## CRITICAL Captive dependency — singleton holds scoped service

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

A singleton can retain the first scoped instance after its scope ends. Eager
build validation rejects this declared captive dependency.

Source: base-container-builder.ts validate()

## HIGH Using factories when constructor registration works

Wrong:

```typescript
.registerSingletonFactory('userService', (container) => {
  const db = container.get('database');
  const logger = container.get('logger');
  return new UserService(db, logger);
})
```

Correct:

```typescript
.registerSingleton('userService', UserService, 'database', 'logger')
```

Constructor registration is shorter and gives Kizuna the dependency list.
Kizuna does not inspect a factory body. Only trailing dependency keys add
factory lookups to `validate()`.

Source: maintainer interview

## HIGH Re-registering a shared singleton in another container

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

## HIGH Mixing add* and register* on the same key

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

## HIGH Using registerSingletonInterface unnecessarily

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

## HIGH Adding decorators that do not exist

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

## HIGH Factory dependency is not declared

Wrong:

```typescript
new ContainerBuilder()
  .registerSingleton('database', DatabaseConnection)
  .registerSingletonFactory('userService', (container) =>
    new UserService(container.get('database')),
  )
```

Correct:

```typescript
new ContainerBuilder()
  .registerSingleton('database', DatabaseConnection)
  .registerSingletonFactory(
    'userService',
    (container) => new UserService(container.get('database')),
    'database',
  )
```

The final key adds the factory lookup to graph validation and cleanup order.
Kizuna does not inspect the factory body.

Source: factory registration methods in `container-builder.ts`

## HIGH Importing internal factory types

Wrong:

```typescript
import { Factory } from '@shirudo/kizuna';
const myFactory: Factory<UserService> = (container) => {
  return new UserService(container.get('database'));
};
```

Correct:

```typescript
// Let TypeScript infer the factory type from the registration method
.registerSingletonFactory('userService', (container) => {
  const db = container.get('database'); // Type-safe!
  return new UserService(db);
}, 'database')
```

The package root does not export `Factory`. Let TypeScript infer the type from
the registration method. The inferred container uses the current typed registry.

Source: types.ts vs container-builder.ts factory signatures

## HIGH Using non-existent APIs from examples

Wrong:

```text
// These methods do not exist on ContainerBuilder
.registerInterface<IDatabase>('db', PostgresDatabase, 'logger')
.registerFactory('config', () => ({ port: 3000 }))

// These methods do not exist on ServiceContainer
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

## HIGH Using get() instead of getAll() for multi-registration keys

Wrong:

```typescript
const container = new ContainerBuilder()
  .addSingleton('validators', LengthValidator)
  .addSingleton('validators', FormatValidator)
  .build();

const validator = container.get('validators');
// Compile-time error; at runtime: "Key 'validators' has multiple registrations. Use getAll('validators') to resolve them."
```

Correct:

```typescript
const validators = container.getAll('validators');
// Explicitly returns Validator[] — intent is clear
```

`get()` rejects a multi-registration key, and `getAll()` rejects a single registration. Each error names the correct method. A constructor dependency on a multi-registration key still receives the array.

Source: container.ts (`get()` and `getAll()`)

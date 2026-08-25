# Validation Errors

## Default build behavior

`build()` validates the declared dependency graph. It rejects these errors:

- A dependency key has no registration.
- A dependency cycle exists.
- A singleton reaches a scoped registration.
- A registration is already disposed.

The build throws one `ContainerValidationError`. Its `issues` property contains
all validation errors.

```typescript
import {
  ContainerBuilder,
  ContainerValidationError,
} from '@shirudo/kizuna';

const builder = new ContainerBuilder()
  .registerSingleton('userService', UserService, 'database' as never);

try {
  builder.build();
} catch (error) {
  if (error instanceof ContainerValidationError) {
    console.error(error.issues);
  }
}
```

TypeScript rejects the missing key in normal TypeScript code. Runtime
validation protects JavaScript and code that uses unsafe casts.

## The validate() result

`validate()` returns the same immutable issues without building a provider.

```typescript
interface ValidationIssue {
  readonly code: ValidationIssueCode;
  readonly message: string;
  readonly serviceKey: string;
  readonly dependencyKey?: string;
  readonly registrationIndex?: number;
  readonly dependencyRegistrationIndex?: number;
  readonly path: readonly string[];
}
```

The public codes are:

- `INVALID_SERVICE_KEY`
- `DISPOSED_REGISTRATION`
- `MISSING_DEPENDENCY`
- `CAPTIVE_DEPENDENCY`
- `CIRCULAR_DEPENDENCY`

Each multi-registration uses a zero-based `registrationIndex`. A dependency can
also have a `dependencyRegistrationIndex`.

## Missing dependency

```text
Service 'userService' depends on unregistered service 'database'
```

Register `database` before `userService`. Then pass `database` as a declared
dependency key.

## Circular dependency

```text
Circular dependency detected: userService -> orderService -> userService
```

Move the shared logic to a third service. Then make both services depend on the
new service.

Do not hide the cycle with an undeclared factory lookup. The runtime resolver
still rejects a dynamic cycle.

## Captive dependency

```text
Service 'userService' is a singleton but depends on scoped service 'requestContext'
```

Change `userService` to scoped, or remove its dependency on request state. A
singleton must not store a scoped value.

## Factory dependency metadata

Declare fixed locator lookups after the factory:

```typescript
const builder = new ContainerBuilder()
  .registerSingleton('database', DatabaseConnection)
  .registerSingletonFactory(
    'userService',
    (provider) => new UserService(provider.get('database')),
    'database',
  );
```

The final key adds an edge for validation and cleanup order. Kizuna does not
inspect the factory body.

An undeclared locator lookup stays invisible to static graph validation. The
runtime resolver still reports lookup failures and dynamic cycles.

## Deferred validation

Use deferred validation only for a graph that must remain dynamic:

```typescript
const container = builder.build({ validation: 'deferred' });
```

This option disables build-time graph validation. Actual lookup failures occur
during resolution. Unused dependency metadata does not trigger a lookup.

## Runtime consistency

Kizuna does not read constructor source code or parameter names. It also does
not read `NODE_ENV`, `process`, or `__DEV__` during validation.

Node.js, browser, and edge runtimes use the same graph rules. Minification does
not change the validation result.

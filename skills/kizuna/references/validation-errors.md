# Validation Errors

## build() does NOT validate

This is the single most important fact about Kizuna. The `build()` method creates a `ServiceProvider` without any checks:

```typescript
// container-builder.ts:273-283
build(): TypeSafeServiceLocator<TRegistry> {
    this.ensureNotBuilt();
    this.markAsBuilt();
    if (this.registrations.size === 0) {
        this.logWarning("Building ServiceProvider with no registered services");
    }
    const registrationsObject = Object.fromEntries(this.registrations);
    return new ServiceProvider<TRegistry>(registrationsObject);
}
```

No call to `validate()`. No missing dependency check. No circular dependency check. No parameter name check. Errors surface at resolution time when a request hits the wrong code path.

Always call `validate()` before `build()`:

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

const builder = new ContainerBuilder()
  .registerSingleton('userService', UserService, 'database', 'logger');

const issues = builder.validate();
if (issues.length > 0) {
  throw new Error(`Container validation failed:\n${issues.join('\n')}`);
}
const container = builder.build();
```

## What validate() checks

1. **Missing dependencies** — a registered service declares a dependency that is not registered.
2. **Circular dependencies** — A depends on B depends on A (detected via DFS).
3. **Parameter name mismatches** (strict mode, enabled by default) — dependency keys don't match constructor parameter names positionally.
4. **Disposed registrations** — a service wrapper that has been disposed.

## What validate() does NOT check

- **Lifecycle mismatches** (captive dependencies) — singleton depending on scoped.
- **Factory dependencies** — dependencies resolved inside factories are invisible.
- **Runtime resolution errors** — factory throws, async factory returns Promise, null return.

## Error types and debugging

### Missing dependency

```
Service 'userService' depends on unregistered service 'database'
```

Fix: Register the missing service before the one that depends on it.

### Circular dependency

```
Circular dependency detected: userService -> orderService -> userService
```

Fix: Break the cycle by extracting the shared dependency into a third service, or use a factory to defer resolution.

### Parameter name mismatch

```
Service 'UserService' parameter 0 is named 'db' but dependency 'DatabaseConnection' is provided.
Consider: .registerSingleton('UserService', UserService, 'db')
```

This happens when the dependency key string doesn't match the constructor parameter name. Two strategies:

**Strategy A — Name registrations after constructor params:**

```typescript
class UserService {
  constructor(private db: DatabaseConnection) {}
}

// Register as 'db' to match the param name
.registerSingleton('db', DatabaseConnection)
.registerSingleton('userService', UserService, 'db')
```

**Strategy B — Name constructor params after registrations:**

```typescript
class UserService {
  constructor(private database: DatabaseConnection) {}
}

// Both key and param are 'database'
.registerSingleton('database', DatabaseConnection)
.registerSingleton('userService', UserService, 'database')
```

Pick one convention and use it consistently across the project.

### Disabling strict parameter validation

```typescript
const builder = new ContainerBuilder()
  .disableStrictParameterValidation()
  .registerSingleton('UserService', UserService, 'DatabaseConnection');
```

This disables only the parameter name check. Missing dependency and circular dependency checks still run. Avoid disabling unless you have a specific reason — the mismatch warnings catch real bugs.

## How parameter name extraction works

The validator extracts parameter names by converting the constructor to a string and matching against regex patterns (base-container-builder.ts:402-461):

```
constructor(params) → extracts from constructor signature
function Name(params) → extracts from function signature
(params) => → extracts from arrow function
```

It strips TypeScript access modifiers (`private`, `public`, `protected`, `readonly`), type annotations, and default values. Destructured parameters and rest params are skipped.

This means minified code may produce incorrect parameter names. Run validation in development, not in production builds.

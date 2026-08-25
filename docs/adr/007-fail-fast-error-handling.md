# ADR-007: Fail-Fast Graph Validation

## Status

Accepted.

## Context

Invalid dependency graphs can fail during request handling. These failures can
occur after the application starts.

The old validator returned text messages. It also read constructor parameter
names from `constructor.toString()`. Minification and runtime globals changed
the result.

Factory lookups and individual multi-registrations also need explicit graph
nodes. The same graph must control build validation and cleanup order.

## Decision

`ContainerBuilder.validate()` returns immutable `ValidationIssue` objects. Each
issue has a stable code, a message, and a dependency path.

An issue can include these fields:

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

Each multi-registration has a separate graph node. Its issue contains a
zero-based `registrationIndex`.

Factory methods accept dependency keys after the factory. These keys add graph
edges without changing the factory argument.

```typescript
.registerSingletonFactory(
  'repository',
  (provider) => new Repository(provider.get('database')),
  'database',
)
```

`build()` runs eager validation by default. If the graph has issues, it throws
one `ContainerValidationError`.

```typescript
const container = builder.build();
```

The error contains the immutable issue list. A failed build does not seal the
builder, so the application can add a missing registration.

Dynamic applications can select deferred validation:

```typescript
const container = builder.build({ validation: 'deferred' });
```

This mode skips static graph validation. Actual lookup failures occur during
resolution. Unused dependency metadata does not trigger a lookup.

Kizuna does not inspect constructor source code or parameter names. Validation
does not depend on `process`, `NODE_ENV`, or `__DEV__`.

## Consequences

- The default build rejects missing, circular, and captive dependencies.
- Node.js, browser, and edge runtimes use the same validation rules.
- Multi-registration issues identify the applicable registration.
- Declared factory dependencies control validation and cleanup order.
- An undeclared factory lookup stays invisible to static graph validation.
- `validate()` no longer returns `string[]`.
- `disableStrictParameterValidation()` no longer exists.

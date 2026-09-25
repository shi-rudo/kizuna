# Changelog

## 1.0.0-rc.10

### Major Changes

- 6f011d3: Report cleanup failures to callers without console output.

  - Attempt all owned cleanup before reporting errors.
  - Throw or reject with one public `DisposalError` that contains the original errors.
  - Extend the JavaScript `AggregateError` class for standard error handling.
  - Report Promise-based cleanup as invalid for sync `dispose()`.
  - Keep dependency cleanup active after a consumer cleanup fails.

- 23d4e27: Close a container before its disposal runs any cleanup.

  - `dispose()` and `disposeAsync()` close the container and its owned lifecycles first, including borrowed singletons. From then on, the container rejects resolution, also for a root singleton that a scope requests while the root disposes asynchronously.
  - A call on the disposed container throws `ContainerDisposedError`. A live container or scope that meets another disposed container throws `ServiceResolutionError` with the `ContainerDisposedError` as `cause`.
  - A singleton or scoped factory that disposes its own container no longer leaves its value behind. After `dispose()`, Kizuna runs the synchronous cleanup of the value, and a failure becomes the `cause`. After `disposeAsync()`, Kizuna runs the asynchronous cleanup in the normal disposal order: the registration waits for it before its declared dependencies are disposed, and a failure appears in the `DisposalError`. `disposeAsync()` does not wait for a Promise value from such a factory, so an `async` factory that calls `disposeAsync()` before its first `await` and then waits for it cannot block it.

- 972f235: Limit the package root to supported consumer contracts and prevent typed registry drift.

  - Hide concrete providers, lifecycle implementations, wrappers, and legacy helper contracts.
  - Return the typed locator interface from `ServiceProviderToken`.
  - Require fixed literal keys for all factory registrations.
  - Remove `remove()` and `clear()` from `ContainerBuilder`.
  - Limit `isRegistered()` to string keys.
  - Document that async factories register Promise values without async resolution.

- 7e93a4e: Separate single and multi-registration resolution.

  - `get()` resolves only keys from `register*()` and interface tokens. It rejects an `add*()` key at compile time and at runtime.
  - `getAll()` resolves only keys from `add*()`. It no longer wraps a single registration in an array.
  - Each runtime error names the correct method.
  - A constructor dependency on an `add*()` key still receives all services as an array.
  - The registry type marks an `add*()` key as `MultiRegistration<T>`, a new public type.
  - Add the builder properties `keyCount` and `registrationCount`. `count` becomes a deprecated alias of `keyCount`.

- 47293d0: Make dependency-graph validation deterministic and fail fast.

  - `validate()` now returns immutable `ValidationIssue` objects with stable codes and paths.
  - `ValidationIssue` now narrows required fields through its `code` property.
  - Each validation path includes structured segments that identify multi-registrations.
  - The legacy `path` value now comes from the structured path segments.
  - A dependency key must be a non-empty string.
  - `build()` now rejects missing, circular, and captive dependencies by default.
  - Use `build({ validation: 'deferred' })` only for a dynamic graph that needs runtime lookup errors.
  - Factory registrations now accept declared dependency keys after the factory.
  - Declared factory keys control graph validation and cleanup order.
  - Multi-registration errors now identify the applicable registration index.
  - `disableStrictParameterValidation()` no longer exists.
  - Kizuna no longer reads constructor source code or parameter names.
  - Validate large and dense graphs with iterative traversal instead of recursion.
  - Use traversal workspace that grows linearly for captive dependencies and independent cycles.
  - Validate immutable registration snapshots instead of lifecycle objects.

- 1f4ad8e: Throw typed errors with stable codes.

  - Add `ServiceNotRegisteredError`, `RegistrationKindError`, `ServiceResolutionError`, `ContainerDisposedError`, `RegistrationConflictError`, `BuilderAlreadyBuiltError`, `InvalidServiceKeyError`, and `SingletonBorrowError`. Each class has a literal `code` and the fields that a caller branches on.
  - Add the codes `CIRCULAR_DEPENDENCY` and `DISPOSAL_FAILED` to `CircularDependencyError` and `DisposalError`.
  - Export the types `RegistrationKind` and `SingletonBorrowFailureReason`.
  - A `ServiceResolutionError` holds the original error as its `cause`. Its message no longer contains `Failed to resolve instance:`.
  - `error.name` is the class name. `InvalidServiceKeyError` still extends `TypeError`.
  - `borrowSingletonFrom()` throws `SingletonBorrowError` for an incompatible source and an invalid reference instead of `TypeError`.

- 4f805d5: Add reusable interface tokens that carry an interface type and one fixed string
  key. Use tokens to register and resolve interface implementations without
  repeating interface, key, and constructor type arguments.

  Replace string interface registration arguments with tokens. Create a token with
  `interfaceToken<Service>()("service")`, pass it to an interface registration
  method, and resolve it with `container.get(token)` or `container.getAll(token)`.

  Type-check interface registration dependencies against registered service types
  and implementation constructor parameter positions.

  Require every public implementation constructor overload to return a service
  that is assignable to the token interface.

  Require TypeScript 5.0 or newer. Interface tokens use const type parameters to
  preserve literal service keys.

### Minor Changes

- fd70b63: Add `borrowSingletonFrom()` for selective, non-owning singleton imports.
  Require the source to be the root container that owns the singleton.
  Support borrowing across compatible ESM, CommonJS, and duplicate package copies.
  Emit declarations that work with TypeScript NodeNext module resolution.
  Type-check every TypeScript example.
  Correct examples that used unavailable APIs.
  Clarify that package builds do not emit example files.
- 241ba66: Use one set of container terms in the public API.

  - Add `ServiceContainer` as the type of the root container and every scope. Factories receive this type.
  - Add `ServiceContainerToken` to resolve the current container or scope.
  - Keep `TypeSafeServiceLocator` and `ServiceProviderToken` as deprecated aliases. `ServiceProviderToken` holds the same symbol as `ServiceContainerToken`.
  - Use the terms container, root container, scope, and factory in errors, JSDoc, and documentation.

- 9d3c0d8: Report diagnostic events to an optional listener.

  - `build({ diagnostics: { listener, level } })` passes typed events to the listener. Each event has a `code`, a `level`, and a `message`, so `listener: (event) => logger[event.level](event, event.message)` logs every event.
  - At the default level `error`, the listener receives `UNAWAITED_CLEANUP_FAILED` for a cleanup failure that no caller waits for: the Promise value of a factory that disposed its own container with `disposeAsync()`, or an asynchronous cleanup that `dispose()` started. Before, Kizuna dropped these failures.
  - At the level `debug`, it also receives `CONTAINER_BUILT`, `SCOPE_STARTED`, `CONTAINER_DISPOSED`, and `SERVICE_CREATED` (each value that a lifecycle created, with its resolution path).
  - Scopes report to the listener of their root container. Without the option, Kizuna reports nothing and still never writes to the console.
  - New public types: `DiagnosticsOptions`, `DiagnosticListener`, `DiagnosticLevel`, `DiagnosticEvent`, `DiagnosticContainerKind`, and one type per event.
  - `build()` checks its options at runtime and throws the new `InvalidBuildOptionsError` (code `INVALID_BUILD_OPTIONS`, fields `option` and `value`) for an unsupported `validation` mode, a `diagnostics.listener` that is not a function, or an unsupported `diagnostics.level`. TypeScript already rejects these values. Before, JavaScript code that passed an unknown `validation` mode got eager validation without an error.

### Patch Changes

- 65f96c1: Dispose consumers before their declared dependencies.

  - Use the same dependency graph for sync and async cleanup.
  - Wait for all async consumers before a dependency cleanup starts.
  - Include every service under a multi-registration key.
  - Keep registration order within each sync disposal layer.
  - Let independent async branches proceed when their own consumers settle.

- 0d4d6d5: Dispose the resolved values of singleton and scoped Promise factories.

  - Make `disposeAsync()` wait for each stored Promise before cleanup.
  - Report a Promise that rejects after disposal starts as a cleanup failure.
  - Report Promise-value cleanup as asynchronous when callers use `dispose()`.

- 3433f0d: Dispose singleton and scoped function values when they implement a supported cleanup hook.
- 5b587a2: Resolve the dependencies of a service only when its lifecycle creates a value.

  - A cached singleton or scoped service no longer resolves its constructor dependencies again on each `get()`. Before, every call created its transient dependencies anew and dropped them without cleanup.
  - A lifecycle that the container closed for disposal rejects the resolution before it resolves any dependency.
  - `dispose()` and `disposeAsync()` also close transient registrations before any cleanup runs. If a dependency calls `dispose()` or `disposeAsync()` of the container, the service is not created and the resolution throws `ContainerDisposedError`.

- 1607d9b: Build an empty container without console output.

  - `build()` no longer writes a warning when the builder has no registrations. An empty container is valid.
  - The library source has no console calls. A lint rule keeps it that way.

- dfad4eb: Retry singleton and scoped factories after a cached Promise rejects.

  - Keep pending and fulfilled Promises cached.
  - Preserve each factory result or rejection through a lifecycle-owned Promise.
  - Normalize cached Promise-like values to a native Promise in types and at runtime.
  - Remove only the rejected Promise from its active lifecycle.
  - Invoke the failed factory again on the next resolution request.

- a1bedb6: Ship only the files that consumers can reach.

  - The package no longer contains the `dist/api/index.*` and `dist/core/index.*` bundles. The export map never published these paths. A deep import such as `@shirudo/kizuna/dist/core/index` worked only with resolvers that ignore the export map, and it now fails at runtime. Import from `@shirudo/kizuna` instead.
  - The package no longer contains declaration maps. They pointed to `src/` files that the package does not ship.
  - The packed tarball shrinks from about 306 KB to 160 KB, and the unpacked size from 1.5 MB to 748 KB. The root bundles and their source maps with embedded sources stay.

- 6b39791: Restructure the packaged Kizuna skill for progressive disclosure.

  - `SKILL.md` now holds the core workflow, the registration and lifetime choices, the rules, and a table that routes each task to a reference. It shrinks from 697 to 144 lines.
  - The wrong and correct code pairs move to the new `references/common-mistakes.md`.
  - `references/registration-patterns.md` gains the borrowing example with an interface token and the builder inspection API. `references/lifecycle-guide.md` gains the `await using` example.

## 1.0.0-rc.9

### Major Changes

- c06177b: Type-check concrete constructor dependency keys against registered service types and constructor parameter positions. Register each dependency before its consumer.

  Fix keys whose service type does not match the parameter at the same position. Remove missing or additional keys.

  The second generic argument now represents the constructor type. Remove explicit instance-type arguments, or replace them with `typeof Service`.

  Require one fixed string literal for each concrete constructor registration key. Reject broad strings, unions, and open template patterns.

  Prevent a root builder from declaring services that do not exist in its runtime registry.

  Check public constructor overloads without a fixed library limit. Accept each declared parameter tuple and preserve different result types as a union.

## 1.0.0-rc.8

### Major Changes

- 73c153e: Remove arbitrary constructor tokens from `get()`. Resolve registered services
  through their string keys. Use `get(ServiceProviderToken)` for the one explicit
  infrastructure-token lookup. Replace existing `get(ServiceProvider)` calls with
  the new symbol token.

## 1.0.0-rc.7

### Patch Changes

- bf581a6: Keep the `ServiceProvider` constructor token separate from the string key `"ServiceProvider"`. A user registration with that string key is no longer overwritten by provider self-resolution.

## 1.0.0-rc.6

### Patch Changes

- d749ee3: Reject interface registration key types that can represent more than one runtime value. This includes unions and open template-literal patterns. Use one fixed string literal as the key type.

## 1.0.0-rc.5

### Patch Changes

- 5794d01: Require the literal service key when an interface registration uses explicit type arguments. This prevents the provider registry from widening to every string key. Update calls such as `registerSingletonInterface<ILogger>('logger', ConsoleLogger)` to `registerSingletonInterface<ILogger, 'logger'>('logger', ConsoleLogger)`.

## 1.0.0-rc.4

### Patch Changes

- 128b137: Add a SemVer release process that keeps package versions and the changelog in sync.

## [1.0.0-rc.3] - 2026-07-04

### Changed (behavior)

- **Duplicate `register*()` keys now throw.** Registering the same key twice
  previously logged a warning and silently overwrote the first registration,
  while the inferred type registry still claimed both types. It now throws an
  error. To replace a registration, call `remove(key)` first and register
  again. Appending multiple services under one key via `add*()` is unaffected.
- **`add*()` methods now validate keys.** Empty or whitespace-only keys were
  previously accepted by `addSingleton()`, `addScoped()`, `addTransient()` and
  their factory variants. They now throw, matching the `register*()` methods.

### Removed

- The unused public API surface has been pruned ahead of 1.0:
  `Constructor<T>` (type), `PendingService` and `ServiceRegistration`
  (interfaces), and `TypeSafeRegistrar.useInstance()`. None of these were
  reachable through the container builder.
- The undocumented `patch` constructor parameter of the container builder,
  which mutated the `name` property of functions in a passed namespace object.
- The accidentally published `intent` bin entry, which installed a broken
  global command for every consumer of the package.

### Added

- `sideEffects: false` in `package.json`, enabling better tree-shaking in
  consuming bundlers.
- `CircularDependencyError` is now exported. It carries the full resolution
  chain (`error.chain`) and a readable message such as
  `Circular dependency detected: a -> b -> a`.
- `validate()` now reports captive dependencies: a singleton depending on a
  scoped service would capture the scoped instance beyond its scope's
  lifetime and use it after the scope is disposed.

### Fixed

- Resolving a dependency cycle at runtime now fails fast with
  `CircularDependencyError` instead of recursing until the call stack
  overflows with an unreadable nested error message.
- `validate()` no longer reports phantom cycles for services that merely
  depend on a member of a real cycle.
- Synchronous `dispose()` now honors `[Symbol.dispose]` (previously only a
  plain `dispose()` method was invoked, so TC39-only resources leaked). As a
  last resort, `[Symbol.asyncDispose]` is invoked fire-and-forget from the
  sync path; use `disposeAsync()` to await it properly.
- Resolution errors now preserve the original error via `Error.cause`, so the
  failing constructor or factory keeps its stack trace.
- `jsr.json` version is synced with `package.json` (now guarded by a test).
- Outdated JSDoc examples that referenced a pre-1.0 registration API, and
  JSDoc snippets quoting error messages that differ from the actual ones.
- Documented that factories must be synchronous: a Promise-returning factory
  is cached as-is and its resolved value is never disposed by the container.
- Development-mode detection no longer requires Node.js type definitions
  (`process` is read via `globalThis`); runtime behavior is unchanged.

## [1.0.0-rc.2] and earlier

Older releases predate this changelog.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Outdated JSDoc examples that referenced a pre-1.0 registration API.

## [1.0.0-rc.2] and earlier

Older releases predate this changelog.

---
"@shirudo/kizuna": major
---

Throw typed errors with stable codes.

- Add `ServiceNotRegisteredError`, `RegistrationKindError`, `ServiceResolutionError`, `ContainerDisposedError`, `RegistrationConflictError`, `BuilderAlreadyBuiltError`, `InvalidServiceKeyError`, and `SingletonBorrowError`. Each class has a literal `code` and the fields that a caller branches on.
- Add the codes `CIRCULAR_DEPENDENCY` and `DISPOSAL_FAILED` to `CircularDependencyError` and `DisposalError`.
- Export the types `RegistrationKind` and `SingletonBorrowFailureReason`.
- A `ServiceResolutionError` holds the original error as its `cause`. Its message no longer contains `Failed to resolve instance:`.
- `error.name` is the class name. `InvalidServiceKeyError` still extends `TypeError`.
- `borrowSingletonFrom()` throws `SingletonBorrowError` for an incompatible source and an invalid reference instead of `TypeError`.

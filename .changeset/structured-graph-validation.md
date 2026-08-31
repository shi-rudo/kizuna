---
"@shirudo/kizuna": major
---

Make dependency-graph validation deterministic and fail fast.

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

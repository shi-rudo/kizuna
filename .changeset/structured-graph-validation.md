---
"@shirudo/kizuna": major
---

Make dependency-graph validation deterministic and fail fast.

- `validate()` now returns immutable `ValidationIssue` objects with stable codes and paths.
- `build()` now rejects missing, circular, and captive dependencies by default.
- Use `build({ validation: 'deferred' })` only for a dynamic graph that needs runtime lookup errors.
- Factory registrations now accept declared dependency keys after the factory.
- Declared factory keys control graph validation and cleanup order.
- Multi-registration errors now identify the applicable registration index.
- `disableStrictParameterValidation()` no longer exists.
- Kizuna no longer reads constructor source code or parameter names.
- Validate large and dense graphs with iterative traversal instead of recursion.

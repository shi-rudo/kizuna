---
"@shirudo/kizuna": minor
---

Use one set of container terms in the public API.

- Add `ServiceContainer` as the type of the root container and every scope. Factories receive this type.
- Add `ServiceContainerToken` to resolve the current container or scope.
- Keep `TypeSafeServiceLocator` and `ServiceProviderToken` as deprecated aliases. `ServiceProviderToken` holds the same symbol as `ServiceContainerToken`.
- Use the terms container, root container, scope, and factory in errors, JSDoc, and documentation.

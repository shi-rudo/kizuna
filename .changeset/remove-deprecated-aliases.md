---
"@shirudo/kizuna": major
---

Remove the deprecated aliases before 1.0.0.

- `ServiceProviderToken` is removed. Use `ServiceContainerToken`. It holds the same symbol.
- `TypeSafeServiceLocator` is removed. Use `ServiceContainer`.
- `ContainerBuilder.count` is removed. Use `keyCount`, or `registrationCount` to count each `add*()` call.

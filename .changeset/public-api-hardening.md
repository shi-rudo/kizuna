---
"@shirudo/kizuna": major
---

Limit the package root to supported consumer contracts and prevent typed registry drift.

- Hide concrete providers, lifecycle implementations, wrappers, and legacy helper contracts.
- Return the typed locator interface from `ServiceProviderToken`.
- Require fixed literal keys for all factory registrations.
- Remove `remove()` and `clear()` from `ContainerBuilder`.
- Limit `isRegistered()` to string keys.
- Document that async factories register Promise values without async resolution.

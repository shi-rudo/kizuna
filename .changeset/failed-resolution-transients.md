---
"@shirudo/kizuna": patch
---

Document that a failed resolution does not clean up transient values.

- If an entry of `getAll()` fails, the transient values of the earlier entries go to no caller and Kizuna does not dispose them.
- The same applies to the transient constructor dependencies of a service that fails.
- A transient factory can return a shared value, so Kizuna leaves these values alone. Register a service that needs cleanup as singleton or scoped.

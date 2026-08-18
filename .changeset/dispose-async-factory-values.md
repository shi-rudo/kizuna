---
"@shirudo/kizuna": patch
---

Dispose the resolved values of singleton and scoped Promise factories.

- Make `disposeAsync()` wait for each stored Promise before cleanup.
- Report rejected factory Promises as cleanup failures.
- Report Promise-value cleanup as asynchronous when callers use `dispose()`.

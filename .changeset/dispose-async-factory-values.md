---
"@shirudo/kizuna": patch
---

Dispose the resolved values of singleton and scoped Promise factories.

- Make `disposeAsync()` wait for each stored Promise before cleanup.
- Report a Promise that rejects after disposal starts as a cleanup failure.
- Report Promise-value cleanup as asynchronous when callers use `dispose()`.

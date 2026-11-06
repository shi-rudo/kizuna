---
"@shirudo/kizuna": minor
---

Bound the number of async cleanups that run at once.

- `disposeAsync()` runs at most 16 asynchronous cleanup hooks at once, also in scopes. Before, it started every independent hook at the same time.
- Add the build option `maxAsyncDisposalConcurrency` to set another limit. It must be a positive integer; another value throws `InvalidBuildOptionsError`.
- A dependency still starts its cleanup only after its consumers.

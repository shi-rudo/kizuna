---
"@shirudo/kizuna": minor
---

Add an optional limit for the async cleanups that run at once.

- The build option `maxAsyncDisposalConcurrency` makes `disposeAsync()` run at most that many asynchronous cleanup hooks at once, also in scopes. It must be a positive integer; another value throws `InvalidBuildOptionsError`.
- Without the option, every independent cleanup hook still starts at once.
- A dependency still starts its cleanup only after its consumers.

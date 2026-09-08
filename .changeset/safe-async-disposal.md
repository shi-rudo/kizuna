---
"@shirudo/kizuna": major
---

Make container disposal safe under concurrent load.

- Limit async cleanup concurrency to 16 by default.
- Add the `maxAsyncDisposalConcurrency` build option.
- Make concurrent `disposeAsync()` calls wait for the same active cleanup.
- Give factories a resolution-only context instead of the full container.
- Add registration indexes to multi-registration cleanup failures.

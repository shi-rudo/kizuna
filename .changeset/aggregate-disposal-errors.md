---
"@shirudo/kizuna": major
---

Report cleanup failures to callers without console output.

- Attempt all owned cleanup before reporting errors.
- Throw or reject with one public `DisposalError` that contains the original errors.
- Extend the JavaScript `AggregateError` class for standard error handling.
- Report Promise-based cleanup as invalid for sync `dispose()`.
- Keep dependency cleanup active after a consumer cleanup fails.

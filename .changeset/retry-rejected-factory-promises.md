---
"@shirudo/kizuna": patch
---

Retry singleton and scoped factories after a cached Promise rejects.

- Keep pending and fulfilled Promises cached.
- Preserve each factory result or rejection through a lifecycle-owned Promise.
- Normalize cached Promise-like values to a native Promise in types and at runtime.
- Remove only the rejected Promise from its active lifecycle.
- Invoke the failed factory again on the next resolution request.

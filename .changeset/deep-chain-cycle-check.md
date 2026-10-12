---
"@shirudo/kizuna": patch
---

Resolve deep dependency chains without a quadratic cycle check.

- The runtime cycle check searched the resolution stack linearly at every step, so a chain of depth d cost O(d²) comparisons. A stack deeper than 16 keys now uses a set and answers in constant time. Shallow resolutions keep the linear scan, which is faster for them.
- `CircularDependencyError` keeps its full chain, and `SERVICE_CREATED` keeps its path.

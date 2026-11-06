---
"@shirudo/kizuna": patch
---

Resolve a cached service without a per-call allocation.

- A warm `get()` allocated a closure and a request object. It now allocates nothing. In the benchmarks, a warm resolution takes 12 to 28 % less time, and `getAll()` 14 to 17 % less.

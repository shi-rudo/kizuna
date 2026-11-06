---
"@shirudo/kizuna": patch
---

Resolve a multi-registration key without a callback for each call.

- `getAll()` and a constructor dependency on a multi-registration key fill an array of the final length in a loop instead of calling `map()` with a closure. In the benchmarks, this takes 12 to 16 % less time.
- Each `getAll()` call still returns a new array that the caller can change. The README now states this.

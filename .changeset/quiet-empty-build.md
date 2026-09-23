---
"@shirudo/kizuna": patch
---

Build an empty container without console output.

- `build()` no longer writes a warning when the builder has no registrations. An empty container is valid.
- The library source has no console calls. A lint rule keeps it that way.

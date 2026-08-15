---
"@shirudo/kizuna": patch
---

Dispose consumers before their declared dependencies.

- Use the same dependency graph for sync and async cleanup.
- Wait for all async consumers before a dependency cleanup starts.
- Include every service under a multi-registration key.
- Keep registration order within each sync disposal layer.
- Let independent async branches proceed when their own consumers settle.

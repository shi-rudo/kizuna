---
"@shirudo/kizuna": major
---

Support the maintained Node.js release lines and the current release.

- `package.json` declares `"engines": { "node": ">=22.12.0" }`. Node.js 20 reached its end of life on 2026-04-30, and Kizuna no longer tests it.
- CI tests Node.js `22.12.x`, `24.x`, and `26.x`. The package E2E workflow runs on Node.js 24.
- A test keeps `engines`, the CI matrix, the workflows, and the documented versions in sync.

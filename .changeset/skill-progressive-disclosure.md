---
"@shirudo/kizuna": patch
---

Restructure the packaged Kizuna skill for progressive disclosure.

- `SKILL.md` now holds the core workflow, the registration and lifetime choices, the rules, and a table that routes each task to a reference. It shrinks from 697 to 144 lines.
- The wrong and correct code pairs move to the new `references/common-mistakes.md`.
- `references/registration-patterns.md` gains the borrowing example with an interface token and the builder inspection API. `references/lifecycle-guide.md` gains the `await using` example.

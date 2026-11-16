---
"@shirudo/kizuna": patch
---

Document why `disposeAsync()` can wait for itself.

- The README section "When `disposeAsync()` never settles" shows the two patterns that wait for themselves: an `async` factory or a cleanup hook that awaits `disposeAsync()` of its own container after an `await`. It also shows how to correct them.
- ADR-014 records why Kizuna keeps these patterns as usage rules and does not detect them.

---
"@shirudo/kizuna": patch
---

Let concurrent `disposeAsync()` calls wait for the running cleanup.

- A `disposeAsync()` call while the cleanup of the container or scope still runs now waits for it and resolves or rejects with the same `DisposalError`. Before, it returned at once, before the cleanup had finished.
- A disposal call after the cleanup has finished is still a no-op.
- When a cleanup hook calls `disposeAsync()` of its own container or scope before its first `await`, the call still resolves at once.

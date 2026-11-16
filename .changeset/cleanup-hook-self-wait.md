---
"@shirudo/kizuna": major
---

A cleanup hook that waits for `disposeAsync()` of its own container after an `await` no longer finishes.

- `disposeAsync()` now waits for a running cleanup. A cleanup hook that awaits something and then awaits `disposeAsync()` of its own container or scope therefore waits for itself, and the disposal never settles. Before, that call returned at once.
- Kizuna cannot detect this call without an asynchronous context. Call `disposeAsync()` before the first `await` of the hook, where it resolves at once, or do not call it from a cleanup hook.

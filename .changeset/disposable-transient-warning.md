---
"@shirudo/kizuna": minor
---

Report transient values that Kizuna never cleans up.

- Add the diagnostic level `warn` between `error` and `debug`, and make it the default. A listener without a `level` receives `error` and `warn` events. Pass `level: 'error'` to receive only failures.
- Add the `DISPOSABLE_TRANSIENT` event at the level `warn`. It reports a transient registration that created a value with `[Symbol.asyncDispose]`, `[Symbol.dispose]`, or `dispose()`. A root container and its scopes report each key once.
- The event does not inspect the Promise of a transient `async` factory, because a handler on it would hide a rejection that the caller ignores. Register an `async` resource that needs cleanup as scoped or singleton.
- A listener that calls `logger[event.level]` needs a logger with a `warn` method.
- Export the `DisposableTransientEvent` type.

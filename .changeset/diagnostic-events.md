---
"@shirudo/kizuna": minor
---

Report diagnostic events to an optional listener.

- `build({ diagnostics: { listener, level } })` passes typed events to the listener. Each event has a `code`, a `level`, and a `message`, so `listener: (event) => logger[event.level](event, event.message)` logs every event.
- At the default level `error`, the listener receives `UNAWAITED_CLEANUP_FAILED` for a cleanup failure that no caller waits for: the Promise value of a factory that disposed its own container with `disposeAsync()`, or an asynchronous cleanup that `dispose()` started. Before, Kizuna dropped these failures.
- At the level `debug`, it also receives `CONTAINER_BUILT`, `SCOPE_STARTED`, `CONTAINER_DISPOSED`, and `SERVICE_CREATED` (each value that a lifecycle created, with its resolution path).
- Scopes report to the listener of their root container. Without the option, Kizuna reports nothing and still never writes to the console.
- New public types: `DiagnosticsOptions`, `DiagnosticListener`, `DiagnosticLevel`, `DiagnosticEvent`, `DiagnosticContainerKind`, and one type per event.

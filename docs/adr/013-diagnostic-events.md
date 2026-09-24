# ADR-013: Diagnostic Events

## Status

Accepted.

## Context

Kizuna reports problems only through thrown errors, and it never writes to the
console (ADR-012). Two kinds of information are lost:

- Some cleanup runs without a caller that waits for it. Its failure has nowhere
  to go:
  - A singleton or scoped factory disposes its own container with
    `disposeAsync()` and returns a Promise value. `disposeAsync()` does not wait
    for that value, so a failure of its cleanup is dropped.
  - `dispose()` starts an asynchronous cleanup that it cannot wait for. The
    caller receives a `TypeError`, but a later rejection of that cleanup is
    dropped.
- Operators and developers have no insight into what the container does: when
  it was built, which scopes start and end, and which values it creates.

Established containers solve this with events that a host can observe. In
.NET, `Microsoft.Extensions.DependencyInjection` emits `EventSource` events
such as `ServiceProviderBuilt`, `ScopeDisposed`, and
`ServiceRealizationFailed`. Autofac offers `DiagnosticListener` tracing. In
both, the library emits typed events and the host decides where they go. The
container cannot take a logger itself, because the logger usually comes from
the container.

## Decision

`build()` accepts an optional `diagnostics` option with a `listener` and a
`level`. Kizuna calls the listener with one event object per occurrence.
Without the option, Kizuna emits nothing and behaves as before.

Each event has a `code`, a `level`, and a `message`:

| `code` | `level` | Additional fields |
| --- | --- | --- |
| `UNAWAITED_CLEANUP_FAILED` | `error` | `serviceKey`, `lifetime`, `operation`, `error` |
| `CONTAINER_BUILT` | `debug` | `keyCount`, `registrationCount`, `validation` |
| `SCOPE_STARTED` | `debug` | none |
| `CONTAINER_DISPOSED` | `debug` | `container`, `mode`, `failureCount` |
| `SERVICE_CREATED` | `debug` | `serviceKey`, `lifetime`, `container`, `path` |

The rules:

- The `level` names match common logger methods. A listener can log every
  event with `logger[event.level](event, event.message)` and never inspect
  `code`.
- The option `level` is a threshold. The default `error` delivers only
  `error` events. `debug` delivers all events.
- Codes use the same upper snake case as validation issue codes and error
  codes. Field names match `DisposalFailure`.
- The event union is open. A later version can add codes. A listener branches
  on the codes that it knows and ignores the others.
- Events carry no durations. In Cloudflare Workers, `performance.now()` and
  `Date.now()` do not advance during synchronous work, so every resolution
  would measure zero. Tracing with durations needs spans with parent and child
  relations and is a separate decision.
- `SERVICE_CREATED` reports a value that a lifecycle created. A cache hit
  produces no event. `path` is the resolution chain of the container that
  resolved the value.
- Scopes use the listener and level of their root container.
- If the listener throws, Kizuna completes its own operation unchanged and
  rethrows the listener error with `queueMicrotask`, like
  `node:diagnostics_channel`. The error stays visible and cannot change the
  result of a Kizuna call.
- The listener runs inside Kizuna calls. Its logger must exist before
  `build()`, and the listener must not resolve services from the container.
  A logger that the container creates would receive events before it exists.
- Kizuna still never writes to the console, not even as a default listener.

Inside Kizuna, the core defines the events and a reporter port. The container
tells the reporter what happened. Only the reporter builds event objects and
applies the level. Lifecycles receive a plain failure callback and do not know
about events.

## Consequences

- Cleanup failures without a waiting caller become observable.
- Hosts can connect Kizuna to any logger, to OpenTelemetry, or to
  `diagnostics_channel` without a dependency in Kizuna.
- Without the option or below `debug`, the resolution path does not build
  events.
- Each code and field becomes public API. Adding a code is compatible.
  Removing or renaming a code or a field is a breaking change.
- A listener that switches exhaustively over `code` must handle unknown codes.

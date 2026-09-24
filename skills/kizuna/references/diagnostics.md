# Diagnostics

Kizuna never writes to the console. It reports diagnostic events to a listener
that `build()` receives. Scopes report to the listener of their root container.

## Log every event

```typescript
const container = builder.build({
  diagnostics: {
    level: 'debug', // optional, the default is 'error'
    listener: (event) => logger[event.level](event, event.message),
  },
});
```

Each event has a `code`, a `level`, and a `message`. The level names match
common logger methods (`error`, `debug`), so this listener needs no code. Pass
the event itself as the structured log fields.

The `level` option is a threshold. The default `error` delivers only failures
that no other channel reports. `debug` also delivers build, scope, disposal,
and creation events. Use `debug` for development and troubleshooting.

## Events

| `code` | `level` | Fields | Use |
| --- | --- | --- | --- |
| `UNAWAITED_CLEANUP_FAILED` | `error` | `serviceKey`, `lifetime`, `operation`, `error` | Alert on cleanup that failed without a waiting caller |
| `CONTAINER_BUILT` | `debug` | `keyCount`, `registrationCount`, `validation` | Log the startup configuration |
| `SCOPE_STARTED` | `debug` | none | Count scopes to find scopes that were never disposed |
| `CONTAINER_DISPOSED` | `debug` | `container`, `mode`, `failureCount` | Confirm shutdown and match scope disposals |
| `SERVICE_CREATED` | `debug` | `serviceKey`, `lifetime`, `container`, `path` | Find services that are created more often than expected |

`UNAWAITED_CLEANUP_FAILED` covers two cases:

- A singleton or scoped factory disposes its own container with
  `disposeAsync()` and returns a Promise value. `disposeAsync()` does not wait
  for that value, so its cleanup failure has no other channel.
- `dispose()` starts an asynchronous cleanup that it cannot wait for. The
  `DisposalError` contains a `TypeError`, and the later rejection arrives as
  this event.

`SERVICE_CREATED` reports each value that a lifecycle created. A cache hit
reports nothing. `path` is the resolution chain of the container that resolved
the value, for example `['userService', 'database']`.

## React to one event

The event union is open. Later versions can add codes. Branch on the codes that
you handle and ignore the others. Do not use an exhaustive `switch` with a
`never` check.

```typescript
listener: (event) => {
  if (event.code === 'UNAWAITED_CLEANUP_FAILED') {
    alerts.notify(event.serviceKey, event.error);
  }
},
```

## Limits

- Events carry no durations. Cloudflare Workers does not advance
  `performance.now()` or `Date.now()` during synchronous work.
- Kizuna reports no event for a cache hit.
- If the listener throws, Kizuna completes its own operation and throws the
  listener error again in a microtask.

---
"@shirudo/kizuna": major
---

Close a container before its disposal runs any cleanup.

- `dispose()` and `disposeAsync()` close the container and its owned lifecycles first, including borrowed singletons. From then on, the container rejects resolution, also for a root singleton that a scope requests while the root disposes asynchronously.
- A call on the disposed container throws `ContainerDisposedError`. A live container or scope that meets another disposed container throws `ServiceResolutionError` with the `ContainerDisposedError` as `cause`.
- A singleton or scoped factory that disposes its own container no longer leaves its value behind. After `dispose()`, Kizuna runs the synchronous cleanup of the value, and a failure becomes the `cause`. After `disposeAsync()`, Kizuna runs the asynchronous cleanup in the normal disposal order: the registration waits for it before its declared dependencies are disposed, and a failure appears in the `DisposalError`. `disposeAsync()` does not wait for a Promise value from such a factory, so an `async` factory that calls `disposeAsync()` before its first `await` and then waits for it cannot block it.

---
"@shirudo/kizuna": major
---

Close a container before its disposal runs any cleanup.

- `dispose()` and `disposeAsync()` close the container and its owned lifecycles first. From then on, a resolution throws `ContainerDisposedError`, also for a root singleton that a scope requests while the root disposes asynchronously.
- A `ContainerDisposedError` is no longer wrapped in a `ServiceResolutionError`.
- A singleton or scoped factory that disposes its own container no longer leaves its value behind. After `dispose()`, Kizuna runs the synchronous cleanup of the value, and a failure becomes the `cause`. After `disposeAsync()`, Kizuna runs the asynchronous cleanup, and `disposeAsync()` waits for it and reports its failure in the `DisposalError`.

---
"@shirudo/kizuna": patch
---

Resolve the dependencies of a service only when its lifecycle creates a value.

- A cached singleton or scoped service no longer resolves its constructor dependencies again on each `get()`. Before, every call created its transient dependencies anew and dropped them without cleanup.
- A lifecycle that the container closed for disposal rejects the resolution before it resolves any dependency.
- `dispose()` and `disposeAsync()` also close transient registrations before any cleanup runs. If a dependency calls `dispose()` or `disposeAsync()` of the container, the service is not created and the resolution throws `ContainerDisposedError`.

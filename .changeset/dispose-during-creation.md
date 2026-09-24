---
"@shirudo/kizuna": patch
---

Clean up a value whose factory disposed its own container.

- A singleton or scoped factory that disposes its container or scope no longer leaves its value in the disposed lifecycle. Kizuna cleans up the value.
- The resolution fails with a `ServiceResolutionError` whose `cause` is a `ContainerDisposedError`. A failing cleanup becomes the `cause` of that `ContainerDisposedError`.

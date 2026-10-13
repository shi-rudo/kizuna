---
"@shirudo/kizuna": major
---

A scope stops creating services once its root starts its disposal.

- A first resolution of a service in a scope now fails with a `ServiceResolutionError` whose cause is a `ContainerDisposedError` as soon as the root container starts `dispose()` or `disposeAsync()`. A shared singleton already failed this way. Before, such a scope still created scoped and transient services.
- Services that the scope resolved before keep working, except shared singletons. A scope keeps working after its parent scope is disposed.
- ADR-006 already required the application to dispose every scope before the root. At shutdown, stop accepting new requests and let the running requests dispose their scopes. Then dispose the root container. The README and the agent skill show this order for Express and NestJS.

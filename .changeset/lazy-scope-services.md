---
"@shirudo/kizuna": patch
---

Start scopes in constant time.

- `startScope()` no longer creates a wrapper for every registration. A scope creates the wrapper of a service on the first resolution of its key. With 1000 registrations, starting a scope took about 140 µs before and now takes well under 1 µs.
- Scope disposal no longer builds the disposal graph for every scope. Sync disposal sorts only the services that the scope created, and async disposal walks a plan that the container computes once. A scope request that starts a scope, resolves three services, and disposes the scope is about 6 times faster with 10 registrations and more than 500 times faster with 1000. The disposal order and the cleanup rules do not change.
- A scope that outlives its root now fails on the first resolution of a service with a `ServiceResolutionError` whose cause is a `ContainerDisposedError`, as a shared singleton already did. ADR-006 already required the application to dispose every scope before the root. Before, such a scope still created scoped and transient services. A scope keeps working after its parent scope is disposed.
- A warm `get()` takes one map lookup instead of two.

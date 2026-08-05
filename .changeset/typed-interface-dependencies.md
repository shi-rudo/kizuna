---
"@shirudo/kizuna": major
---

Type-check interface registration dependency keys against registered service
types and implementation constructor parameter positions.

Add the implementation constructor as the third type argument when an interface
registration has dependencies. For example, use
`registerScopedInterface<Service, "service", typeof ServiceImplementation>(...)`.

Keep the two-type-argument form for implementations without constructor
dependencies. Calls without explicit type arguments infer the implementation
type and check its dependencies.

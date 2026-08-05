---
"@shirudo/kizuna": major
---

Type-check interface registration dependency keys against registered service
types and implementation constructor parameter positions.

For dependency-aware interface registrations, require every public implementation
constructor overload to return a service that is assignable to the explicit
interface type.

Add the implementation constructor as the third type argument when an interface
registration has dependencies. For example, use
`registerScopedInterface<Service, "service", typeof ServiceImplementation>(...)`.

Keep the two-type-argument form for implementations without constructor
dependencies. Calls without explicit type arguments infer the implementation
type and check its dependencies.

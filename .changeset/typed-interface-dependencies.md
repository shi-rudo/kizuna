---
"@shirudo/kizuna": major
---

Add reusable interface tokens that carry an interface type and one fixed string
key. Use tokens to register and resolve interface implementations without
repeating interface, key, and constructor type arguments.

Replace string interface registration arguments with tokens. Create a token with
`interfaceToken<Service>()("service")`, pass it to an interface registration
method, and resolve it with `container.get(token)` or `container.getAll(token)`.

Type-check interface registration dependencies against registered service types
and implementation constructor parameter positions.

Require every public implementation constructor overload to return a service
that is assignable to the token interface.

Require TypeScript 5.0 or newer. Interface tokens use const type parameters to
preserve literal service keys.

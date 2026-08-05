---
"@shirudo/kizuna": major
---

Type-check concrete constructor dependency keys against registered service types and constructor parameter positions. Register each dependency before its consumer.

Fix keys whose service type does not match the parameter at the same position. Remove missing or additional keys.

The second generic argument now represents the constructor type. Remove explicit instance-type arguments, or replace them with `typeof Service`.

Require one fixed string literal for each concrete constructor registration key. Reject broad strings, unions, and open template patterns.

Prevent a root builder from declaring services that do not exist in its runtime registry.

Check public constructor overloads without a fixed library limit. Accept each declared parameter tuple and preserve different result types as a union.

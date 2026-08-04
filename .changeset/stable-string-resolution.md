---
"@shirudo/kizuna": major
---

Remove arbitrary constructor tokens from `get()`. Resolve registered services
through their string keys. Use `get(ServiceProviderToken)` for the one explicit
infrastructure-token lookup. Replace existing `get(ServiceProvider)` calls with
the new symbol token.

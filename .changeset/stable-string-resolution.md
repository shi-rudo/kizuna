---
"@shirudo/kizuna": major
---

Remove arbitrary constructor tokens from `get()`. Resolve registered services
through their string keys. `get(ServiceProvider)` remains available as the one
explicit infrastructure-token lookup.

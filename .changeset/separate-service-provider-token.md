---
"@shirudo/kizuna": patch
---

Keep the `ServiceProvider` constructor token separate from the string key `"ServiceProvider"`. A user registration with that string key is no longer overwritten by provider self-resolution.

---
"@shirudo/kizuna": major
---

Separate single and multi-registration resolution.

- `get()` resolves only keys from `register*()` and interface tokens. It rejects an `add*()` key at compile time and at runtime.
- `getAll()` resolves only keys from `add*()`. It no longer wraps a single registration in an array.
- Each runtime error names the correct method.
- A constructor dependency on an `add*()` key still receives all services as an array.
- The registry type marks an `add*()` key as `MultiRegistration<T>`, a new public type.
- Add the builder properties `keyCount` and `registrationCount`. `count` becomes a deprecated alias of `keyCount`.

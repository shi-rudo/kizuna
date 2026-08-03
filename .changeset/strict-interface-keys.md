---
"@shirudo/kizuna": patch
---

Require the literal service key when an interface registration uses explicit type arguments. This prevents the provider registry from widening to every string key. Update calls such as `registerSingletonInterface<ILogger>('logger', ConsoleLogger)` to `registerSingletonInterface<ILogger, 'logger'>('logger', ConsoleLogger)`.

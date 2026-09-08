# Factory Resolution Context Migration

Factory callbacks now receive a `TypeSafeServiceResolver`. The resolver only
provides `get()` and `getAll()`.

The resolver prevents accidental lifecycle changes through the callback
argument. It does not expose these container operations:

- `startScope()`
- `dispose()`
- `disposeAsync()`
- `get(ServiceProviderToken)`

Most factory callbacks need no change. Rename an explicit
`TypeSafeServiceLocator` parameter to `TypeSafeServiceResolver`:

```typescript
import type { TypeSafeServiceResolver } from '@shirudo/kizuna';

type Registry = { Config: Config };

const createDatabase = (resolver: TypeSafeServiceResolver<Registry>) => {
  return new Database(resolver.get('Config'));
};
```

Create scopes and dispose containers in the application composition root. Do
not run these lifecycle operations in a factory callback.

Factory code remains trusted application code. The resolver does not restrict
a container reference that the factory gets from another source.

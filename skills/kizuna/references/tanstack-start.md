# TanStack Start Integration

TanStack Start has server middleware, loaders, and actions — each with different scoping needs.

**Status:** These patterns are recommendations based on TanStack Start architecture constraints. They are not documented in Kizuna's official docs.

## The core challenge

- **Loaders** can run in parallel for the same route. If each loader creates its own scope, scoped services are not shared between sibling loaders.
- **Actions** run individually, so scoping per action is straightforward.
- **Server middleware** exists in TanStack Start but has a different API surface than Express-style middleware.

## Server middleware

TanStack Start's `createMiddleware` can manage scopes across loaders and actions.

```typescript
// app/middleware.ts
import { createMiddleware } from '@tanstack/start';
import { container } from '@/lib/container';

export const withScope = createMiddleware().server(async ({ next }) => {
  const scope = container.startScope();
  try {
    const result = await next({ context: { scope } });
    return result;
  } finally {
    scope.dispose();
  }
});
```

## Loaders

Attach the middleware to route loaders. All loaders in the same request share the same scope via middleware context.

```typescript
// app/routes/users.$id.tsx
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { withScope } from '@/middleware';

const getUser = createServerFn({ method: 'GET' })
  .middleware([withScope])
  .handler(async ({ context }) => {
    const userService = context.scope.get('userService');
    return userService.findById(context.params.id);
  });

export const Route = createFileRoute('/users/$id')({
  loader: () => getUser(),
  component: UserPage,
});
```

## Actions

Actions work the same way — attach the middleware for scoping.

```typescript
import { createServerFn } from '@tanstack/start';
import { withScope } from '@/middleware';

const createUser = createServerFn({ method: 'POST' })
  .middleware([withScope])
  .handler(async ({ context, data }) => {
    const userService = context.scope.get('userService');
    return userService.create(data);
  });
```

## Fallback: scope per function

If middleware is not available or not desired, create and dispose a scope within each server function.

```typescript
import { createServerFn } from '@tanstack/start';
import { container } from '@/lib/container';

const getUser = createServerFn({ method: 'GET' })
  .handler(async ({ data }) => {
    const scope = container.startScope();
    try {
      const userService = scope.get('userService');
      return userService.findById(data.id);
    } finally {
      scope.dispose();
    }
  });
```

The tradeoff: parallel loaders for the same route each get independent scopes. Scoped services are not shared between them.

## Key differences from Express

| Concern | Express | TanStack Start |
| --- | --- | --- |
| Scope creation | Middleware `app.use()` | `createMiddleware().server()` |
| Scope sharing | Via `req.scope` | Via middleware `context` |
| Disposal trigger | `res.on('finish')` | `finally` block in middleware |
| Parallel loaders | N/A | Share scope via middleware context |

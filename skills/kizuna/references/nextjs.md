# Next.js Integration

Next.js does not have a middleware chain like Express. The scoping question becomes: where does the scope live?

**Status:** These patterns are recommendations based on Next.js architecture constraints. They are not documented in Kizuna's official docs.

## The core challenge

In Express, you create a scope in middleware and dispose it on response end. In Next.js:

- **Route handlers** run as standalone functions — no shared middleware lifecycle.
- **Server components** are rendered by React — you have no lifecycle hooks for cleanup.
- **Server actions** can be called from anywhere — scope boundary is unclear.

## Which pattern where

| Context | Pattern | Scope sharing | Disposal |
| --- | --- | --- | --- |
| Route handler (`GET`, `POST`) | Scope at top of handler | Within handler only | `finally` block |
| Server component | Scope per component | Not shared between components | `finally` block |
| Server action | Scope per action | Within action only | `finally` block |
| Multiple components need shared state | `withScope` helper + pass data down | Via return value, not scope | `finally` in helper |

**Key insight:** In Next.js, every entry point gets its own scope. There is no way to share a scope across server components in the same render.

## Route handlers

The simplest case. Create a scope at the top, dispose at the end.

```typescript
// app/api/users/[id]/route.ts
import { container } from '@/lib/container';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const scope = container.startScope();
  try {
    const userService = scope.get('userService');
    const { id } = await params;
    const user = userService.findById(id);
    return Response.json(user);
  } finally {
    scope.dispose();
  }
}
```

## Server components

Create a scope per component render, use it, dispose immediately.

```typescript
// app/users/[id]/page.tsx
import { container } from '@/lib/container';

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = container.startScope();
  try {
    const userService = scope.get('userService');
    const { id } = await params;
    const user = userService.findById(id);
    return <div>{user.name}</div>;
  } finally {
    scope.dispose();
  }
}
```

**Tradeoff:** Multiple server components on the same page each get their own scope. Scoped services cannot coordinate across components in the same render. If you need shared data, resolve it in a parent and pass it via props.

## Server actions

Scope per action invocation.

```typescript
// app/actions.ts
'use server';

import { container } from '@/lib/container';

export async function createUser(formData: FormData) {
  const scope = container.startScope();
  try {
    const userService = scope.get('userService');
    const name = formData.get('name') as string;
    return userService.create({ name });
  } finally {
    scope.dispose();
  }
}
```

## withScope helper — reducing boilerplate

When every entry point follows the same try/finally pattern, extract a helper:

```typescript
// lib/with-scope.ts
import { container } from '@/lib/container';

export async function withScope<T>(
  fn: (scope: ReturnType<typeof container.startScope>) => T | Promise<T>,
): Promise<T> {
  const scope = container.startScope();
  try {
    return await fn(scope);
  } finally {
    scope.dispose();
  }
}
```

Usage:

```typescript
import { withScope } from '@/lib/with-scope';

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await withScope((scope) => {
    return scope.get('userService').findById(id);
  });
  return <div>{user.name}</div>;
}
```

**When `withScope` makes sense:** When you have 3+ entry points that all follow the same scope-per-call pattern. For a single route handler, inline try/finally is clearer.

## When to use singletons vs. scoped

| Service type | Lifecycle | Why |
| --- | --- | --- |
| DB connection pool | Singleton | Shared across all renders, never recreated |
| Logger | Singleton | Stateless, no reason to scope |
| User context / auth | Scoped | Different per request/render |
| Request ID | Scoped factory | Unique per scope: `.registerScopedFactory('requestId', () => crypto.randomUUID())` |
| Stateless utility | Transient | No caching needed |

## What does NOT work

- **Global scope per request** — Next.js does not expose a per-request lifecycle that spans all server components in a render.
- **React cache() for scope sharing** — `React.cache()` memoizes within a render, but there is no hook to dispose the scope when the render completes.
- **Middleware-based scoping** — Next.js middleware runs on the Edge runtime and cannot share objects with server components running in Node.js.

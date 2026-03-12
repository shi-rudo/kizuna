# Next.js Integration

Next.js does not have a middleware chain like Express. The scoping question becomes: where does the scope live?

**Status:** These patterns are recommendations based on Next.js architecture constraints. They are not documented in Kizuna's official docs.

## The core challenge

In Express, you create a scope in middleware and dispose it on response end. In Next.js:

- **Route handlers** run as standalone functions — no shared middleware lifecycle.
- **Server components** are rendered by React — you have no lifecycle hooks for cleanup.
- **Server actions** can be called from anywhere — scope boundary is unclear.

## Route handlers

Route handlers are the simplest case. Create a scope at the top, dispose it at the end.

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

Server components are functions called by React. You cannot control when React disposes them. The safest pattern: create a scope per component render, use it, and dispose immediately.

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

The drawback: if multiple server components on the same page each create scopes, scoped services are not shared between them. Each component gets its own instance. This is correct isolation behavior but means scoped services cannot coordinate across components in the same render.

## Server actions

Server actions are invoked individually. Scope per action invocation.

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

## Helper to reduce boilerplate

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

## What does NOT work

- **Global scope per request** — Next.js does not expose a per-request lifecycle that spans all server components in a render.
- **React cache() for scope sharing** — `React.cache()` memoizes within a render, but there is no hook to dispose the scope when the render completes.
- **Middleware-based scoping** — Next.js middleware runs on the Edge runtime and cannot share objects with server components running in Node.js.

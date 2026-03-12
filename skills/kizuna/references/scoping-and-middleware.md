# Scoping and Middleware

Request scoping creates a fresh set of scoped service instances per request while sharing singletons across all requests.

## The pattern

1. Call `container.startScope()` at request start.
2. Use `scope.get()` to resolve services within the request.
3. Call `scope.dispose()` when the request completes.

Scoped services share one instance within the scope. Different scopes get different instances. Singletons are shared across all scopes.

## Express

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import express from 'express';

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerScoped('userService', UserService, 'logger')
  .registerScopedFactory('requestId', () => crypto.randomUUID())
  .build();

const app = express();

app.use((req, res, next) => {
  req.scope = container.startScope();
  res.on('finish', () => req.scope.dispose());
  next();
});

app.get('/users/:id', (req, res) => {
  const userService = req.scope.get('userService');
  res.json(userService.findById(req.params.id));
});

// TypeScript: extend the Request type
declare module 'express' {
  interface Request {
    scope: ReturnType<typeof container.startScope>;
  }
}
```

## Hono

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import { Hono } from 'hono';

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerScoped('userService', UserService, 'logger')
  .build();

const app = new Hono();

app.use('*', async (c, next) => {
  const scope = container.startScope();
  c.set('scope', scope);
  await next();
  scope.dispose();
});

app.get('/users/:id', (c) => {
  const scope = c.get('scope');
  const userService = scope.get('userService');
  return c.json(userService.findById(c.req.param('id')));
});
```

## Fastify

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import Fastify from 'fastify';

const container = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerScoped('userService', UserService, 'logger')
  .build();

const fastify = Fastify();

fastify.addHook('onRequest', (request, reply, done) => {
  request.scope = container.startScope();
  done();
});

fastify.addHook('onResponse', (request, reply, done) => {
  request.scope.dispose();
  done();
});

fastify.get('/users/:id', (request, reply) => {
  const userService = request.scope.get('userService');
  reply.send(userService.findById(request.params.id));
});
```

## What lives where

| Lifecycle | Root container | Scope A | Scope B |
| --- | --- | --- | --- |
| Singleton | Instance X | Instance X (same) | Instance X (same) |
| Scoped | Instance 1 | Instance 2 (new) | Instance 3 (new) |
| Transient | new each get() | new each get() | new each get() |

## Disposal behavior

- **Scoped instances:** If the instance has a `dispose()` method, it is called when the scope is disposed.
- **Singleton instances:** `dispose()` is a no-op. Singletons are never cleaned up by scope disposal.
- **Transient instances:** Not tracked. The lifecycle holds no references.

Always dispose scopes. Undisposed scopes leak whatever resources scoped services hold (connections, file handles, transactions).

## registerInstance() does not exist

The docs show `scope.registerInstance('RequestId', requestId)` — this method does not exist. Scopes returned by `startScope()` are read-only `ServiceProvider` instances. You cannot add registrations after construction.

For per-request values, use scoped factories:

```typescript
.registerScopedFactory('requestId', () => crypto.randomUUID())
```

## Performance: startScope() is O(n)

Every `startScope()` allocates a new `ServiceProvider`, a new record object, and a new `ServiceWrapper` for every registered service — including singletons. With many services and high request throughput, this creates allocation pressure. There is no scope pooling or `reset()` method.

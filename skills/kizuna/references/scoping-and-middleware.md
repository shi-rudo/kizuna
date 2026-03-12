# Scoping and Middleware

Request scoping creates a fresh set of scoped service instances per request while sharing singletons across all requests.

## The pattern

1. Call `container.startScope()` at request start.
2. Use `scope.get()` / `scope.getAll()` to resolve services within the request.
3. Call `scope.dispose()` when the request completes.

Scoped services share one instance within the scope. Different scopes get different instances. Singletons are shared across all scopes.

## Which framework pattern

| Framework | Scope creation | Scope access | Disposal trigger |
| --- | --- | --- | --- |
| Express | `app.use()` middleware | `req.scope` | `res.on('finish')` |
| Hono | `app.use('*')` middleware | `c.get('scope')` via typed context | After `await next()` |
| Fastify | `onRequest` hook | `request.scope` via decorator | `onResponse` hook |
| NestJS | Interceptor or guard | `request.scope` | Interceptor `finalize()` |

## Shared container setup

All examples below use this container:

```typescript
// lib/container.ts
import { ContainerBuilder } from '@shirudo/kizuna';

class Logger {
  log(msg: string) { console.log(`[${new Date().toISOString()}] ${msg}`); }
}

class UserRepository {
  constructor(private logger: Logger) {}
  findById(id: string) {
    this.logger.log(`Finding user ${id}`);
    return { id, name: 'Alice' };
  }
}

class AuditTrail {
  constructor(private logger: Logger) {}
  record(action: string) { this.logger.log(`AUDIT: ${action}`); }
}

const builder = new ContainerBuilder()
  // Singletons — shared across all requests
  .registerSingleton('logger', Logger)
  .registerSingletonFactory('config', () => ({
    dbUrl: process.env.DATABASE_URL ?? 'postgres://localhost/dev',
  }))
  // Scoped — one per request
  .registerScoped('userRepository', UserRepository, 'logger')
  .registerScoped('auditTrail', AuditTrail, 'logger')
  .registerScopedFactory('requestId', () => crypto.randomUUID())
  // Multi-registration — all middleware handlers
  .addSingletonFactory('middleware', () => ({ name: 'auth', run: () => {} }))
  .addSingletonFactory('middleware', () => ({ name: 'cors', run: () => {} }));

const issues = builder.validate();
if (issues.length > 0) throw new Error(issues.join('\n'));

export const container = builder.build();
```

## Express

```typescript
import express from 'express';
import { container } from './lib/container';

const app = express();

// Scope middleware — creates and disposes scope per request
app.use((req, res, next) => {
  req.scope = container.startScope();
  res.on('finish', () => req.scope.dispose());
  next();
});

app.get('/users/:id', (req, res) => {
  const userRepo = req.scope.get('userRepository');
  const audit = req.scope.get('auditTrail');
  const requestId = req.scope.get('requestId');

  const user = userRepo.findById(req.params.id);
  audit.record(`user.read:${req.params.id} [${requestId}]`);

  res.json(user);
});

// Multi-registration: run all middleware handlers
app.use((req, res, next) => {
  const handlers = container.getAll('middleware');
  handlers.forEach(h => h.run());
  next();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  container.dispose(); // Disposes all singletons (logger, config, middleware)
  process.exit(0);
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
import { Hono } from 'hono';
import { container } from './lib/container';

// Type-safe context variables
type Env = {
  Variables: {
    scope: ReturnType<typeof container.startScope>;
  };
};

const app = new Hono<Env>();

// Scope middleware
app.use('*', async (c, next) => {
  const scope = container.startScope();
  c.set('scope', scope);
  try {
    await next();
  } finally {
    scope.dispose();
  }
});

app.get('/users/:id', (c) => {
  const scope = c.get('scope');
  const userRepo = scope.get('userRepository');
  const audit = scope.get('auditTrail');
  const requestId = scope.get('requestId');

  const user = userRepo.findById(c.req.param('id'));
  audit.record(`user.read:${c.req.param('id')} [${requestId}]`);

  return c.json(user);
});

// Multi-registration in middleware
app.use('*', async (c, next) => {
  const handlers = container.getAll('middleware');
  handlers.forEach(h => h.run());
  await next();
});

export default app;
```

**Hono-Besonderheit:** `try/finally` um `await next()` ist sicherer als `scope.dispose()` nach `next()` — garantiert Disposal auch bei Fehlern.

## Fastify

```typescript
import Fastify from 'fastify';
import { container } from './lib/container';

const fastify = Fastify();

// Decorator for type safety
fastify.decorateRequest('scope', null);

// Scope hooks
fastify.addHook('onRequest', (request, reply, done) => {
  request.scope = container.startScope();
  done();
});

fastify.addHook('onResponse', (request, reply, done) => {
  request.scope.dispose();
  done();
});

fastify.get('/users/:id', (request, reply) => {
  const userRepo = request.scope.get('userRepository');
  const audit = request.scope.get('auditTrail');
  const requestId = request.scope.get('requestId');

  const user = userRepo.findById((request.params as any).id);
  audit.record(`user.read:${(request.params as any).id} [${requestId}]`);

  reply.send(user);
});

// Graceful shutdown
fastify.addHook('onClose', (instance, done) => {
  container.dispose();
  done();
});

// TypeScript: extend request
declare module 'fastify' {
  interface FastifyRequest {
    scope: ReturnType<typeof container.startScope>;
  }
}
```

**Fastify-Besonderheit:** `onResponse` wird auch bei Fehlern aufgerufen — Disposal ist zuverlässig. `onClose` Hook eignet sich für Container-Dispose beim Shutdown.

## NestJS (Hybrid — Kizuna neben NestJS DI)

Kizuna ersetzt nicht den NestJS-eigenen DI-Container. Dieses Pattern nutzt Kizuna für spezifische Module neben NestJS.

```typescript
// lib/kizuna-container.ts
import { ContainerBuilder } from '@shirudo/kizuna';

export const kizunaContainer = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerScoped('auditTrail', AuditTrail, 'logger')
  .registerScopedFactory('requestId', () => crypto.randomUUID())
  .addSingletonFactory('validators', () => new LengthValidator())
  .addSingletonFactory('validators', () => new FormatValidator())
  .build();
```

```typescript
// kizuna-scope.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { kizunaContainer } from './lib/kizuna-container';

@Injectable()
export class KizunaScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.kizunaScope = kizunaContainer.startScope();

    return next.handle().pipe(
      tap({
        finalize: () => request.kizunaScope.dispose(),
      }),
    );
  }
}
```

```typescript
// users.controller.ts
import { Controller, Get, Param, Req } from '@nestjs/common';
import { UseInterceptors } from '@nestjs/common';
import { KizunaScopeInterceptor } from './kizuna-scope.interceptor';

@Controller('users')
@UseInterceptors(KizunaScopeInterceptor)
export class UsersController {
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const audit = req.kizunaScope.get('auditTrail');
    const requestId = req.kizunaScope.get('requestId');
    audit.record(`user.read:${id} [${requestId}]`);

    // Multi-registration: validate input with all validators
    const validators = kizunaContainer.getAll('validators');
    const allValid = validators.every(v => v.validate(id));

    return { id, valid: allValid };
  }
}
```

```typescript
// main.ts — graceful shutdown
import { NestFactory } from '@nestjs/core';
import { kizunaContainer } from './lib/kizuna-container';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  process.on('SIGTERM', () => {
    kizunaContainer.dispose();
  });

  await app.listen(3000);
}
```

**Wann NestJS + Kizuna Sinn ergibt:**
- Migration: Schrittweise Teile von NestJS DI zu Kizuna verlagern
- Multi-Registration: NestJS hat kein `getAll()` — Kizuna schon
- Framework-agnostische Module: Services die auch außerhalb von NestJS laufen sollen

**Wann NICHT:** Wenn die gesamte App NestJS ist und du keinen Vorteil aus Kizunas Features ziehst. Zwei DI-Container sind Overhead.

## What lives where

| Lifecycle | Root container | Scope A (Request 1) | Scope B (Request 2) |
| --- | --- | --- | --- |
| Singleton | Instance X | Instance X (same) | Instance X (same) |
| Scoped | — | Instance A | Instance B (new) |
| Transient | new each get() | new each get() | new each get() |
| Multi (singleton) | [Impl1, Impl2] | [Impl1, Impl2] (same) | [Impl1, Impl2] (same) |
| Multi (scoped) | — | [new A1, new A2] | [new B1, new B2] |

## Disposal behavior

- **Scoped instances:** If the instance has a `dispose()` method, it is called when the scope is disposed.
- **Singleton instances:** Disposed only when the **root container** is disposed (not when child scopes are disposed). If the singleton instance has a `dispose()` method, it is called automatically.
- **Transient instances:** Not tracked. The lifecycle holds no references.
- **Multi-registrations:** Each implementation follows its own lifecycle's disposal rules.

Always dispose scopes. Undisposed scopes leak whatever resources scoped services hold (connections, file handles, transactions).

After `container.dispose()`, all calls to `get()`, `getAll()`, and `startScope()` throw `"Cannot access services from a disposed container"`.

## Common mistake: scopes are read-only

Do NOT try to add registrations to a scope. Scopes returned by `startScope()` are read-only `ServiceProvider` instances. Methods like `registerInstance()` and `reset()` do not exist.

For per-request values, use scoped factories:

```typescript
.registerScopedFactory('requestId', () => crypto.randomUUID())
```

## Performance: startScope() is O(n)

Every `startScope()` allocates a new `ServiceProvider`, a new record object, and a new `ServiceWrapper` for every registered service — including singletons. With many services and high request throughput, this creates allocation pressure. There is no scope pooling or `reset()` method.

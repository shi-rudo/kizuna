# Edge Runtimes — Cloudflare Workers, Vercel Edge

Kizuna is built for edge runtimes: ~10 KB gzipped, zero Node-API dependencies (only `process.env` access is guarded behind a `typeof process` check), no module-level mutable state that could leak across isolate-reused requests. A CI smoke suite (`tests/edge-compat.test.ts`) boots the built bundle inside workerd via miniflare to guard against regressions.

## Cloudflare Workers pattern

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

// Built once per isolate at module load — cheap (no service is instantiated here)
const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerScoped('RequestContext', RequestContext)
  .registerScoped('UserService', UserService, 'Logger', 'RequestContext')
  .build();

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const scope = container.startScope();
    try {
      // Use the scope synchronously inside the handler
      return await handle(req, scope);
    } finally {
      // Schedule async cleanup AFTER the scope was used. ctx.waitUntil lets it
      // run after the response is sent, without adding latency to the request.
      ctx.waitUntil(scope.disposeAsync());
    }
  }
};
```

**Why `try/finally` matters:** `scope.disposeAsync()` marks the scope disposed synchronously at the start of the async function it returns. If you scheduled it before using the scope, every subsequent `scope.get(...)` call inside `handle()` would throw `"Cannot access services from a disposed container"`. The `finally` block runs after `await handle(req, scope)` resolves, ensuring disposal is scheduled only once the scope is no longer in use.

## Vercel Edge Functions pattern

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerScoped('RequestContext', RequestContext)
  .build();

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // `await using` ensures disposeAsync runs on every code path (including throws),
  // and blocks the response until cleanup completes. Acceptable when cleanup is fast.
  //
  // For fire-and-forget post-response cleanup, Vercel exposes waitUntil via
  // `import { waitUntil } from '@vercel/functions'` — use a try/finally pattern
  // like the Workers example and pass scope.disposeAsync() to waitUntil() instead
  // of awaiting it inline.
  await using scope = container.startScope();
  return handle(req, scope);
}
```

## Isolate reuse: don't put request state in singletons

Edge runtimes reuse the same isolate across requests. A `Singleton` lives for the lifetime of the isolate — across users. If a singleton accidentally captures request-specific state (auth tokens, user IDs, tenant data), that state leaks to the next request served by the same isolate.

This is not a Kizuna bug — it's the definition of `Singleton`. But the failure mode is more dangerous on the edge than on a per-process server, because isolate-sharing is invisible by default.

**Rule of thumb:**

| Use Singleton for | Use Scoped for | Use Transient for |
| --- | --- | --- |
| Stateless services | Anything touching the current request | Lightweight per-call helpers |
| Configuration | `RequestContext`, auth state | UUID generators |
| Infrastructure clients with their own pooling (DB clients, KV bindings, loggers) | Per-request DB transactions | Timestamps |

If you find yourself mutating a singleton after first construction, it should probably be Scoped instead.

## Strict parameter validation under minification

`strictParameterValidation` inspects `constructor.toString()` to match dependency names to parameter names. Edge bundlers (esbuild, webpack) mangle parameter names during minification, which would produce false warnings.

Kizuna **auto-disables this check when `NODE_ENV === "production"`** (or when `process` is unavailable, which is the case in workerd). No opt-out required for edge deploys; the check still runs in development to catch real ordering bugs early.

## What kizuna does NOT do for you

- **Code-splitting per service** — kizuna does not provide `registerSingletonAsyncFactory` or similar. If service A is heavy and only used on one route, route-level splitting (Workers' multiple `fetch` handlers, Vercel's per-route Edge Functions) is the right primitive.
- **Cross-isolate state sharing** — singletons are per-isolate. Use Durable Objects, KV, or the platform's primitives for shared state.
- **Connection pooling** — register the platform's binding (e.g. `env.DB`, `env.KV`) as a singleton; kizuna does not wrap it.

## See also

- [Lifecycle guide](lifecycle-guide.md) — captive-dependency rules apply doubly on the edge (a singleton holding a scoped instance becomes cross-request state in an isolate)
- [Scoping and middleware](scoping-and-middleware.md) — Node-side patterns for comparison

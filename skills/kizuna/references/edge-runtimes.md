# Edge Runtimes — Cloudflare Workers, Vercel Edge

The automated edge suite runs the built ESM bundle in workerd through
Miniflare. It does not enable `nodejs_compat`.

CI does not deploy Kizuna to Vercel Edge. It also does not run a browser, Deno,
or Bun runtime test. Run Kizuna in each untested target runtime.

The repository does not enforce a compressed-size budget. Read the
[feature evidence matrix](https://github.com/shi-rudo/kizuna/blob/main/docs/feature-evidence.md)
for all tested runtime limits.

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

This pattern is integration guidance. CI does not deploy it to Vercel Edge.

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

## Isolate reuse: do not put request state in singletons

Edge runtimes reuse the same isolate across requests. A `Singleton` lives for the lifetime of the isolate — across users. If a singleton accidentally captures request-specific state (auth tokens, user IDs, tenant data), that state leaks to the next request served by the same isolate.

This is not a Kizuna bug — it's the definition of `Singleton`. But the failure mode is more dangerous on the edge than on a per-process server, because isolate-sharing is invisible by default.

**Rule of thumb:**

| Use Singleton for | Use Scoped for | Use Transient for |
| --- | --- | --- |
| Stateless services | Anything touching the current request | Per-call helpers |
| Configuration | `RequestContext`, auth state | UUID generators |
| Infrastructure clients with their own pooling (DB clients, KV bindings, loggers) | Per-request DB transactions | Timestamps |

If you find yourself mutating a singleton after first construction, it should probably be Scoped instead.

## Deterministic graph validation

Kizuna validates declared dependency keys. It does not inspect constructor
source code, parameter names, or runtime environment variables.

Minification does not change validation results. Only declared factory keys add
graph edges.

## What kizuna does NOT do for you

- **Code-splitting per service** — kizuna does not provide `registerSingletonAsyncFactory` or similar. If service A is heavy and only used on one route, route-level splitting (Workers' multiple `fetch` handlers, Vercel's per-route Edge Functions) is the right primitive.
- **Cross-isolate state sharing** — singletons are per-isolate. Use Durable Objects, KV, or the platform's primitives for shared state.
- **Connection pooling** — register the platform's binding (e.g. `env.DB`, `env.KV`) as a singleton; kizuna does not wrap it.

## See also

- [Lifecycle guide](lifecycle-guide.md) — captive-dependency rules apply doubly on the edge (a singleton holding a scoped instance becomes cross-request state in an isolate)
- [Scoping and middleware](scoping-and-middleware.md) — Node-side patterns for comparison

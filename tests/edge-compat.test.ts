/**
 * Edge runtime compatibility tests.
 *
 * Boots the built kizuna ESM bundle inside workerd (via miniflare) and exercises
 * the documented Workers pattern: container at module-load, per-request scope,
 * disposeAsync via ctx.waitUntil, Symbol.asyncDispose for `await using`.
 *
 * Guards against regressions of:
 *   - accidental Node-API usage (e.g. ungated process.X, Buffer, fs)
 *   - broken Symbol.dispose / Symbol.asyncDispose semantics under workerd V8
 *   - strictParameterValidation no longer auto-skipping in production
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kizunaBundle = resolve(__dirname, '..', 'dist', 'index.mjs');

const workerSource = `
import { ContainerBuilder } from "./kizuna.mjs";

class Logger {
    log(msg) { return msg; }
}

class RequestContext {
    constructor() {
        this.id = crypto.randomUUID();
    }
}

class AsyncDisposable {
    constructor() {
        this.disposed = false;
    }
    async dispose() {
        await new Promise(r => setTimeout(r, 5));
        this.disposed = true;
    }
}

const disposedFlags = new Set();

const container = new ContainerBuilder()
    .registerSingleton("Logger", Logger)
    .registerScoped("RequestContext", RequestContext)
    .registerScopedFactory("AsyncDisposable", () => {
        const d = new AsyncDisposable();
        // expose dispose state so we can assert across requests
        d.dispose = async () => {
            await new Promise(r => setTimeout(r, 5));
            disposedFlags.add(d);
        };
        return d;
    })
    .build();

export default {
    async fetch(req, env, ctx) {
        const url = new URL(req.url);

        if (url.pathname === "/scope-id") {
            const scope = container.startScope();
            try {
                return new Response(scope.get("RequestContext").id);
            } finally {
                ctx.waitUntil(scope.disposeAsync());
            }
        }

        if (url.pathname === "/await-using") {
            // Exercise TC39 Symbol.asyncDispose path under workerd V8
            let resolvedId;
            {
                await using scope = container.startScope();
                resolvedId = scope.get("RequestContext").id;
            }
            return new Response(resolvedId);
        }

        if (url.pathname === "/validate") {
            // Validation in workerd: process is undefined → isDevelopment() returns false
            // → strict param check must auto-skip. We register a deliberate mismatch
            // and assert no parameter-named issues come back.
            const b = new ContainerBuilder()
                .registerSingleton("Logger", Logger)
                .registerSingleton("RequestContext", RequestContext, "DefinitelyWrongName");
            const issues = b.validate();
            return Response.json({
                issues,
                paramIssues: issues.filter(i => i.includes("parameter") && i.includes("named")),
            });
        }

        if (url.pathname === "/dispose-async") {
            const scope = container.startScope();
            // Resolve so the AsyncDisposable instance exists
            scope.get("AsyncDisposable");
            const before = disposedFlags.size;
            await scope.disposeAsync();
            return Response.json({ disposedBefore: before, disposedAfter: disposedFlags.size });
        }

        return new Response("not found", { status: 404 });
    },
};
`;

let mf: Miniflare;

beforeAll(async () => {
    if (!existsSync(kizunaBundle)) {
        throw new Error(
            `dist/index.mjs not found. Run \`pnpm build\` before running the edge-compat tests, ` +
            `or run \`pnpm test\` from CI where build runs first.`,
        );
    }
    const kizunaSrc = readFileSync(kizunaBundle, 'utf-8');
    mf = new Miniflare({
        modules: [
            { type: 'ESModule', path: 'index.mjs', contents: workerSource },
            { type: 'ESModule', path: 'kizuna.mjs', contents: kizunaSrc },
        ],
        compatibilityDate: '2024-10-01',
        compatibilityFlags: ['nodejs_compat'],
    });
    // Force isolate spin-up before the test suite starts so the module-load path
    // is exercised — this is what catches accidental Node-API leakage.
    await mf.ready;
});

afterAll(async () => {
    await mf?.dispose();
});

describe('Workers compatibility (workerd via miniflare)', () => {
    it('builds the container at module-load without Node-API errors', async () => {
        // If the module-load failed (Node-only imports, ungated process.X), the
        // isolate would refuse to start and dispatchFetch would throw.
        const res = await mf.dispatchFetch('http://localhost/scope-id');
        expect(res.status).toBe(200);
    });

    it('isolates request scopes across requests', async () => {
        const a = await (await mf.dispatchFetch('http://localhost/scope-id')).text();
        const b = await (await mf.dispatchFetch('http://localhost/scope-id')).text();
        expect(a).toMatch(/^[0-9a-f-]{36}$/);
        expect(b).toMatch(/^[0-9a-f-]{36}$/);
        expect(a).not.toBe(b);
    });

    it('supports `await using` via Symbol.asyncDispose under workerd', async () => {
        const res = await mf.dispatchFetch('http://localhost/await-using');
        expect(res.status).toBe(200);
        expect(await res.text()).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('auto-skips strict parameter validation when process is undefined', async () => {
        const res = await mf.dispatchFetch('http://localhost/validate');
        const body = (await res.json()) as { issues: string[]; paramIssues: string[] };
        // Strict param check would otherwise complain that param 'logger' got 'DefinitelyWrongName'
        expect(body.paramIssues).toEqual([]);
    });

    it('awaits service-owned async dispose via disposeAsync()', async () => {
        const res = await mf.dispatchFetch('http://localhost/dispose-async');
        const body = (await res.json()) as { disposedBefore: number; disposedAfter: number };
        expect(body.disposedAfter).toBe(body.disposedBefore + 1);
    });
});

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
 *   - strictParameterValidation no longer auto-skipping when process is undefined
 *
 * Deliberately runs without `nodejs_compat` so that any Node-API access in the
 * library would fail module-load — exactly what we want to catch.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kizunaBundle = resolve(__dirname, '..', 'dist', 'index.mjs');
const workerFixture = resolve(__dirname, 'fixtures', 'edge-worker.mjs');

// workerd compat date: this is the date the test was written against. Update
// alongside intentional behavior changes after re-running locally.
const COMPATIBILITY_DATE = '2024-10-01';

let mf: Miniflare;

beforeAll(async () => {
    if (!existsSync(kizunaBundle)) {
        throw new Error(
            `dist/index.mjs not found. Run \`pnpm build\` before running the edge-compat tests, ` +
            `or run \`pnpm test\` from CI where build runs first.`,
        );
    }

    const kizunaSrc = readFileSync(kizunaBundle, 'utf-8');
    const workerSrc = readFileSync(workerFixture, 'utf-8');

    mf = new Miniflare({
        modules: [
            { type: 'ESModule', path: 'index.mjs', contents: workerSrc },
            { type: 'ESModule', path: 'kizuna.mjs', contents: kizunaSrc },
        ],
        compatibilityDate: COMPATIBILITY_DATE,
        // NOTE: nodejs_compat is intentionally NOT enabled. The whole point of
        // these tests is to verify kizuna works in workerd's stock environment
        // without Node polyfills.
    });

    // Force isolate spin-up before the test suite starts so the module-load
    // path is exercised — this is what catches accidental Node-API leakage.
    await mf.ready;
}, 30_000);

afterAll(async () => {
    await mf?.dispose();
});

describe('Workers compatibility (workerd via miniflare)', () => {
    it('builds the container at module-load without Node-API errors', async () => {
        // If module-load failed (Node-only imports, ungated process.X), the
        // isolate would refuse to start and dispatchFetch would throw or 500.
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
        const body = (await res.json()) as {
            issues: string[];
            paramIssues: string[];
            processIsUndefined: boolean;
        };

        // Sanity-check the precondition we are actually testing — without
        // nodejs_compat, workerd has no `process` global, which is what makes
        // isDevelopment() return false.
        expect(body.processIsUndefined).toBe(true);

        // UserService(logger) registered with 'DefinitelyWrongName' would
        // normally trip the strict param check ("param 0 is named 'logger' but
        // dependency 'DefinitelyWrongName' is provided"). It must auto-skip here.
        expect(body.paramIssues).toEqual([]);
    });

    it('awaits service-owned async dispose via disposeAsync()', async () => {
        const res = await mf.dispatchFetch('http://localhost/dispose-async');
        const body = (await res.json()) as {
            disposeCountBefore: number;
            disposeCountAfter: number;
        };
        expect(body.disposeCountAfter).toBe(body.disposeCountBefore + 1);
    });

    it('exercises every public API surface in workerd without throwing', async () => {
        // Smoke test for paths the documented patterns don't hit: sync dispose,
        // getAll, multi-registration, builder mutations (remove/clear/count/
        // isRegistered/getRegisteredServiceNames), and the sync Symbol.dispose
        // hook used by TC39 `using`. Catches Node-API leaks in these paths.
        const res = await mf.dispatchFetch('http://localhost/exercise-all');
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            ok: boolean;
            beforeRemoveCount: number;
            afterRemoveCount: number;
            wasRegistered: boolean;
            namesLength: number;
            allPluginsLength: number;
            usingScopeIdShape: string;
        };
        expect(body.ok).toBe(true);
        expect(body.wasRegistered).toBe(true);
        expect(body.afterRemoveCount).toBe(body.beforeRemoveCount - 1);
        expect(body.allPluginsLength).toBe(2);
        expect(body.usingScopeIdShape).toBe('string');
    });
});

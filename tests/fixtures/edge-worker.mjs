/**
 * Worker entry for tests/edge-compat.test.ts. Loaded as a string by the test
 * setup and passed to miniflare as the entry module. Imports `./kizuna.mjs`,
 * which the test wires up from the built ESM bundle.
 *
 * Each route exercises one documented behavior; assertions live in the test file.
 */

import { ContainerBuilder } from "./kizuna.mjs";

class Logger {
    log(msg) { return msg; }
}

class RequestContext {
    constructor() {
        this.id = crypto.randomUUID();
    }
}

// Class with named constructor params for the /validate route — strict
// validation would otherwise complain that param 'logger' got 'DefinitelyWrongName'.
class UserService {
    constructor(logger) {
        this.logger = logger;
    }
}

let disposeCount = 0;

const container = new ContainerBuilder()
    .registerSingleton("Logger", Logger)
    .registerScoped("RequestContext", RequestContext)
    .registerScopedFactory("AsyncResource", () => ({
        async dispose() {
            await new Promise(r => setTimeout(r, 5));
            disposeCount++;
        },
    }))
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
            // Without `nodejs_compat`, workerd has no `process` global.
            // isDevelopment() should therefore return false → strict param check
            // must auto-skip. UserService(logger) registered with 'DefinitelyWrongName'
            // would otherwise produce a parameter-name-mismatch issue.
            const b = new ContainerBuilder()
                .registerSingleton("Logger", Logger)
                .registerSingleton("UserService", UserService, "DefinitelyWrongName");
            const issues = b.validate();
            return Response.json({
                issues,
                paramIssues: issues.filter(i => i.includes("parameter") && i.includes("named")),
                processIsUndefined: typeof process === "undefined",
            });
        }

        if (url.pathname === "/dispose-async") {
            const scope = container.startScope();
            scope.get("AsyncResource"); // instantiate so dispose runs
            const before = disposeCount;
            await scope.disposeAsync();
            return Response.json({ disposeCountBefore: before, disposeCountAfter: disposeCount });
        }

        if (url.pathname === "/exercise-all") {
            // Touches every public API surface that the other routes don't exercise.
            // The assertion is just "no throw" — semantics live in the unit tests.
            // This catches Node-API leakage in code paths the documented patterns
            // never hit (sync dispose, getAll, builder mutations, Symbol.dispose).
            const b = new ContainerBuilder()
                .registerSingleton("Logger", Logger)
                .registerTransient("RequestContext", RequestContext)
                .addSingleton("plugins", Logger)
                .addSingleton("plugins", Logger);

            const beforeRemoveCount = b.count;
            const wasRegistered = b.isRegistered("Logger");
            const names = b.getRegisteredServiceNames();
            b.remove("Logger");
            const afterRemoveCount = b.count;
            b.registerSingleton("Logger", Logger);

            const c = b.build();
            const all = c.getAll("plugins");
            const sync = c.startScope();
            sync.dispose(); // sync dispose path

            // TC39 sync `using` hook
            let usingScopeId;
            {
                using scope = c.startScope();
                usingScopeId = scope.get("RequestContext").id;
            }

            c.dispose();

            return Response.json({
                ok: true,
                beforeRemoveCount,
                afterRemoveCount,
                wasRegistered,
                namesLength: names.length,
                allPluginsLength: all.length,
                usingScopeIdShape: typeof usingScopeId,
            });
        }

        return new Response("not found", { status: 404 });
    },
};

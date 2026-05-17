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

        return new Response("not found", { status: 404 });
    },
};

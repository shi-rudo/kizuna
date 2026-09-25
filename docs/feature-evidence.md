# Feature Claims and Evidence

This matrix records the public feature claims for Kizuna. Each row links to
automated evidence and states the tested limit.

The runtime suite runs through `pnpm test`. The type suite runs through
`pnpm test:types`. The example suite runs through `pnpm test:examples`.

## Evidence matrix

| Claim | Automated evidence | Exact limit |
| --- | --- | --- |
| The builder infers fixed registry keys and the value type for `get()`. | [Public type tests](../tests/public-api-hardening.test-d.ts) | JavaScript and unsafe casts bypass compile-time checks. |
| Constructor dependencies use compile-time count, type, and position checks. | [Constructor dependency type tests](../tests/constructor-dependencies.test-d.ts) | Structural typing cannot distinguish keys that provide the same structural type. |
| Interface tokens connect one fixed string key with an interface type. | [Interface token type tests](../tests/interface-token.test-d.ts) | Interface conformance uses TypeScript structural typing. |
| One builder supports constructor, interface, and factory registrations. | [Container builder tests](../tests/container-builder.test.ts) | Only declared factory keys create graph edges. |
| Singleton, scoped, and transient lifecycles have distinct cache behavior. | [Lifecycle tests](../tests/container-builder.test.ts) | Kizuna does not export a custom lifecycle extension point. |
| Multi-registration preserves registration order and lifecycle behavior. | [Multi-registration tests](../tests/multi-registration.test.ts), [strict resolution tests](../tests/strict-multi-resolution.test.ts) | `getAll()` resolves only `add*()` keys and `get()` only single registrations; the wrong method fails at compile time and at runtime. |
| Build validation reports missing keys, cycles, and captive dependencies with stable issue codes and registration-aware paths. | [Structured validation tests](../tests/structured-validation.test.ts), [validation type tests](../tests/validation-api.test-d.ts), [factory validation tests](../tests/factory-dependency-validation.test.ts), and [multi-registration validation tests](../tests/multi-registration-validation.test.ts) | Deferred builds and undeclared factory lookups bypass static graph validation. |
| Every error that the public API can throw has an exported class with a literal code. | [Error contract tests](../tests/error-contracts.test.ts) and [error contract type tests](../tests/error-contracts.test-d.ts) | Internal invariant errors that the public API cannot reach stay generic. |
| A dependency key must be a non-empty string. | [Dependency-key validation tests](../tests/dependency-key-validation.test.ts) | TypeScript rejects most invalid keys before runtime. The runtime rule protects JavaScript and unsafe casts. |
| Validation workspace allocation grows linearly for many singleton roots and independent cycles. | [Graph scale tests](../tests/registration-graph-scale.test.ts) and [graph benchmarks](../benchmarks/registration-graph.bench.ts) | Issue paths and the issue count can still grow with the declared graph. |
| Child scopes isolate scoped values and share singleton values. | [Scope tests](../tests/container-builder.test.ts) | The root is also a scope, and the root does not track child scopes. |
| Disposal cleans owned values in dependency-aware order and aggregates errors. | [Disposal order tests](../tests/disposal-order.test.ts) and [disposal error tests](../tests/disposal-errors.test.ts) | Transient values are untracked, and independent async branches have no completion order. |
| Singleton and scoped factories can expose stored Promise values. | [Promise factory tests](../tests/async-factory-disposal.test.ts) | Resolution stays synchronous, and the stored observer can have a different identity. |
| A domain container can borrow selected root-owned singletons without cleanup ownership. | [Borrowing tests](../tests/borrowed-singleton.test.ts) and [domain ownership tests](../tests/example-container-ownership.test.ts) | Kizuna does not enforce domain boundaries or cross-domain communication rules. |
| Test containers can replace service contracts without `any`. | [Documentation contract test](../tests/documentation-api.test.ts) | This check requires strict TypeScript and cannot protect JavaScript or unsafe casts. |
| The published package has no runtime dependency entries. | [Package contract test](../tests/documentation-api.test.ts) | The package still has development and peer dependencies. |
| CI covers Node.js, a packed Vite consumer build, and workerd through Miniflare. | [CI workflow](../.github/workflows/ci.yml), [package E2E workflow](../.github/workflows/e2e.yml), and [workerd tests](../tests/edge-compat.test.ts) | CI does not run a browser, Vercel Edge, Deno, Bun, or Node.js 18 runtime test. |
| An optional listener receives typed diagnostic events, including cleanup failures that no caller waits for. | [Diagnostics tests](../tests/diagnostics.test.ts) and [diagnostics type tests](../tests/diagnostics.test-d.ts) | Events carry no durations, a cache hit produces no event, and Kizuna never writes events to the console. |
| The package stays within the [size budgets](#package-size). | [Package contents tests](../tests/package-contents.test.ts) | The budgets measure the Kizuna package. A consumer bundle also contains application code, and the tarball size can vary with the npm version. |
| Pull-request workflows run the listed gates for release-candidate changes. | [CI workflow](../.github/workflows/ci.yml) and [E2E workflow](../.github/workflows/e2e.yml) | The gates do not prove application fitness, load capacity, security, or production readiness. |

## Quality gates

The [CI workflow](../.github/workflows/ci.yml) runs these commands on Node.js
`20.19.x`, `22.12.x`, and `24.x`:

- `pnpm build`
- `pnpm test`
- `pnpm test:types`
- `pnpm test:examples`

A separate CI job runs `pnpm check` once on Node.js `24.x`. It fails when
formatting, import order, or lint rules report an error. Unused imports and
shadowed variables count as errors.

The [package E2E workflow](../.github/workflows/e2e.yml) creates the package
tarball. It installs that tarball in a Vite React TypeScript project.

The package gate checks runtime exports, structured validation errors, ESM and
CommonJS interoperability, NodeNext declarations, and the Vite consumer build.

The runtime suite includes the [workerd compatibility tests](../tests/edge-compat.test.ts).
These tests run the built ESM bundle through Miniflare without `nodejs_compat`.

These quality gates do not certify an application for production use. A team
must evaluate Kizuna against its runtime, load, security, and support needs.

## Package size

The [package contents tests](../tests/package-contents.test.ts) measure the
built package in every CI run. A test fails when a value exceeds its budget.

The values were measured on 2026-09-25:

- Root entry, minified ESM, gzip: 7.9 KiB, budget 9 KiB
- Shipped `dist/index.mjs`, gzip: 17.8 KiB, budget 20 KiB
- Packed tarball: 171.5 KiB, budget 200 KiB
- Unpacked package: 792.6 KiB, budget 900 KiB

The minified value comes from an esbuild build of the root entry with all
exports. A consumer bundle that uses fewer exports can be smaller. The unpacked
package also contains the source maps, the type declarations, the README, and
the agent skill.

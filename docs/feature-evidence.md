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
| Multi-registration preserves registration order and lifecycle behavior. | [Multi-registration tests](../tests/multi-registration.test.ts) | `get()` returns an array for a multi-key, and `getAll()` wraps a single registration. |
| Build validation reports missing keys, cycles, and captive dependencies with stable issue codes and paths. | [Structured validation tests](../tests/structured-validation.test.ts), [factory validation tests](../tests/factory-dependency-validation.test.ts), and [multi-registration validation tests](../tests/multi-registration-validation.test.ts) | Deferred builds and undeclared factory lookups bypass static graph validation. |
| Child scopes isolate scoped values and share singleton values. | [Scope tests](../tests/container-builder.test.ts) | The root is also a scope, and the root does not track child scopes. |
| Disposal cleans owned values in dependency-aware order and aggregates errors. | [Disposal order tests](../tests/disposal-order.test.ts) and [disposal error tests](../tests/disposal-errors.test.ts) | Transient values are untracked, and independent async branches have no completion order. |
| Singleton and scoped factories can expose stored Promise values. | [Promise factory tests](../tests/async-factory-disposal.test.ts) | Resolution stays synchronous, and the stored observer can have a different identity. |
| A domain container can borrow selected root-owned singletons without cleanup ownership. | [Borrowing tests](../tests/borrowed-singleton.test.ts) and [domain ownership tests](../tests/example-container-ownership.test.ts) | Kizuna does not enforce domain boundaries or cross-domain communication rules. |
| Test containers can replace service contracts without `any`. | [Documentation contract test](../tests/documentation-api.test.ts) | This check requires strict TypeScript and cannot protect JavaScript or unsafe casts. |
| The published package has no runtime dependency entries. | [Package contract test](../tests/documentation-api.test.ts) | The package still has development and peer dependencies. |
| CI covers Node.js, a packed Vite consumer build, and workerd through Miniflare. | [CI workflow](../.github/workflows/ci.yml), [package E2E workflow](../.github/workflows/e2e.yml), and [workerd tests](../tests/edge-compat.test.ts) | CI does not run a browser, Vercel Edge, Deno, Bun, or Node.js 18 runtime test. |
| Pull-request workflows run the listed gates for release-candidate changes. | [CI workflow](../.github/workflows/ci.yml) and [E2E workflow](../.github/workflows/e2e.yml) | The gates do not prove application fitness, load capacity, security, or production readiness. |

## Quality gates

The [CI workflow](../.github/workflows/ci.yml) runs these commands on Node.js
`20.19.x`, `22.12.x`, and `24.x`:

- `pnpm build`
- `pnpm test`
- `pnpm test:types`
- `pnpm test:examples`

The [package E2E workflow](../.github/workflows/e2e.yml) creates the package
tarball. It installs that tarball in a Vite React TypeScript project.

The package gate checks runtime exports, ESM and CommonJS interoperability,
NodeNext declarations, and the Vite consumer build.

The runtime suite includes the [workerd compatibility tests](../tests/edge-compat.test.ts).
These tests run the built ESM bundle through Miniflare without `nodejs_compat`.

These quality gates do not certify an application for production use. A team
must evaluate Kizuna against its runtime, load, security, and support needs.

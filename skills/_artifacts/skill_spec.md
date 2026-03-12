# @shirudo/kizuna -- Skill Spec

A lightweight, zero-dependency, type-safe dependency injection container for TypeScript and JavaScript. Provides a fluent `ContainerBuilder` API with constructor, interface, and factory registration patterns across singleton, scoped, and transient lifecycles, plus multi-registration for plugin/middleware patterns.

## Domains

| Domain | Description | Skills |
| --- | --- | --- |
| dependency injection | Building, configuring, and using a DI container -- registration, lifecycles, scoping, multi-registration, validation, testing, framework integration | kizuna |

## Skill Inventory

| Skill | Type | Domain | What it covers | Failure modes |
| --- | --- | --- | --- | --- |
| kizuna | core | dependency-injection | ContainerBuilder, TypeSafeServiceLocator, 15 registration methods (9 single + 6 multi), 3 lifecycles, validate(), getAll(), scoping, disposal, testing, framework integration, migration | 15 |

## Failure Mode Inventory

### Kizuna (15 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | Omitting mandatory string key in registration | CRITICAL | maintainer interview; container-builder.ts | -- |
| 2 | Assuming build() validates the container | CRITICAL | maintainer interview; container-builder.ts:273-283 | -- |
| 3 | Captive dependency -- singleton captures scoped service | CRITICAL | maintainer interview | -- |
| 4 | Using factory registration when constructor registration suffices | HIGH | maintainer interview | -- |
| 5 | Using registerSingletonInterface when registerSingleton works | HIGH | maintainer interview | -- |
| 6 | Adding decorators that do not exist | HIGH | maintainer interview | -- |
| 7 | Parameter name vs registration name mismatch | HIGH | maintainer interview; base-container-builder.ts:171-193 | -- |
| 8 | Believing null factory return breaks caching (myth — code uses _initialized flag) | MEDIUM | singleton.ts:54,132; scoped.ts:68,150 | -- |
| 9 | Using non-existent APIs from examples and docs | HIGH | examples/unified-container-example.ts; concurrency-patterns.md | -- |
| 10 | Using the stale Factory<T> type alias | MEDIUM | types.ts:57 vs container-builder.ts | -- |
| 11 | Assuming singleton dispose is a no-op (it now disposes correctly) | MEDIUM | singleton.ts:187-203 | -- |
| 12 | Async factory returns Promise instead of resolved value | MEDIUM | maintainer interview; ADR-001 | -- |
| 13 | startScope() is O(n) on total registrations | MEDIUM | maintainer interview; service-provider.ts:49-57 | -- |
| 14 | Over-wrapping build() in try-catch | MEDIUM | maintainer interview | -- |
| 15 | Mixing add* and register* on the same key | HIGH | base-container-builder.ts | -- |

## Tensions

| Tension | Skills | Agent implication |
| --- | --- | --- |
| Parameter naming convention vs class naming convention | kizuna | Agent defaults to class-name keys, hits validation warnings, then either disables strict validation or creates naming inconsistency |
| Getting-started simplicity vs production safety | kizuna | Agent generating production code skips validate() because the quickstart doesn't use it |
| Type safety ergonomics vs API surface size | kizuna | Agent picks registerSingletonInterface based on name similarity rather than understanding it only affects the resolved type |
| Factory flexibility vs hidden dependency graph | kizuna | Agent defaults to factories, silently breaking the validation safety net |

## Cross-References

No cross-references (single skill).

## Subsystems & Reference Candidates

| Skill | Subsystems | Reference candidates |
| --- | --- | --- |
| kizuna | -- | registration-patterns, lifecycle-guide, validation-errors, middleware-scoping, nextjs-integration, tanstack-start-integration, testing-patterns, migration-guide |

## Remaining Gaps

| Skill | Question | Status |
| --- | --- | --- |
| kizuna | Recommended scoping patterns for Next.js server components, route handlers, server actions | open |
| kizuna | Recommended scoping patterns for TanStack Start loaders and actions | open |
| kizuna | Should ServiceProvider self-registration be documented or is it internal? | open |
| kizuna | Recommended pattern for container composition / module system | open |

## Recommended Skill File Structure

- **Core skills:** kizuna (single skill covering all of @shirudo/kizuna)
- **Framework skills:** none (framework integration covered via reference files within the core skill)
- **Lifecycle skills:** none (getting-started and migration covered via reference files)
- **Composition skills:** none (framework patterns covered via reference files)
- **Reference files:**
  - `references/registration-patterns.md` -- constructor vs interface vs factory, when to use which
  - `references/lifecycle-guide.md` -- singleton/scoped/transient, captive dependency, disposal
  - `references/validation-errors.md` -- validate() contract, error types, parameter name tension
  - `references/scoping-and-middleware.md` -- Express/Hono/Fastify patterns, scope lifecycle
  - `references/testing.md` -- test containers, stubs, scope isolation
  - `references/nextjs.md` -- scoping without middleware in Next.js
  - `references/tanstack-start.md` -- loader/action scoping
  - `references/migration.md` -- from manual wiring, from decorator-based DI

## Composition Opportunities

| Library | Integration points | Composition skill needed? |
| --- | --- | --- |
| Express | Middleware for request scoping | No -- covered in references/scoping-and-middleware.md |
| Hono | Middleware for request scoping | No -- same reference file |
| Fastify | Plugin/hook for request scoping | No -- same reference file |
| Next.js | Route handlers, server components, server actions | No -- covered in references/nextjs.md |
| TanStack Start | Loaders, actions, server middleware | No -- covered in references/tanstack-start.md |

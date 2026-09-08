# ADR-005: Internal Lifecycle Strategies

## Status

Superseded by ADR-003 for the public registration API.

## Context

Kizuna supports singleton, scoped, transient, and borrowed singleton
registrations. Each lifetime has different cache and ownership rules.

The public package does not support custom lifecycle implementations. The
builder is the only public registration entry point.

## Decision

Kizuna uses one internal strategy for each lifecycle.

| Strategy | Cache rule | Value owner |
|---|---|---|
| Singleton | One value for the root and its scopes | The root container |
| Scoped | One value in each container or scope | The container or scope |
| Transient | No cache | The caller |
| Borrowed singleton | One reference to a source value | The source root container |

All strategies implement the internal `ServiceLifecycle` contract. The
`ServiceWrapper` combines a strategy with dependency metadata.

A child scope shares a singleton strategy with its root. The child wrapper does
not own this shared strategy.

A child scope gets a new scoped strategy. This strategy owns the value that the
child scope resolves.

A transient strategy does not track returned values. The caller must clean
these values.

A borrowed strategy only clears its source reference. It does not clean the
borrowed value.

## Rationale

Separate strategies keep cache and ownership rules out of the provider. The
provider can apply one resolution and disposal flow to all registrations.

The strategies are internal. This boundary prevents a custom lifecycle from
bypassing ownership, Promise, retry, or disposal rules.

## Consequences

- The builder supports a fixed set of lifecycle methods.
- Kizuna can change internal strategy types without a public API change.
- A new public lifecycle requires a new design decision.
- Tests must cover cache, ownership, scope, Promise, and disposal behavior.

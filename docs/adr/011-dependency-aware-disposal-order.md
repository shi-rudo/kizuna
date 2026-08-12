# ADR-011: Dependency-Aware Disposal Order

## Status

Accepted.

## Context

The registration API records the dependency keys for each constructor. The container resolves these dependencies before it creates a consumer.

The old disposal path ignored these keys. Sync disposal used storage order, and async disposal started all cleanup at the same time.

A dependency sometimes closed before its consumer completed cleanup. This behavior made database clients and similar resources unsafe during shutdown.

## Decision

The provider creates a disposal graph from the declared dependency keys. Each graph edge points from a consumer to its dependency.

A dependency key can identify one service or a multi-registration group. The graph includes each service in that group.

The provider puts circular components into one group. It then processes the graph in consumer-first layers.

Sync disposal invokes each layer in registration order. Async disposal starts the root groups in parallel.

Async disposal starts each dependency group after all its consumer groups settle. Unrelated graph branches do not block one another.

Services in the same disposal layer keep their registration order. The provider keeps one order across single registrations and multi-registrations.

Factory registrations do not declare dependency keys. Service lookups inside a factory do not add edges to the disposal graph.

## Consequences

- Consumer cleanup can use a declared dependency until the consumer cleanup completes.
- Independent cleanup stays parallel in the async path.
- Multi-registration dependencies use the same order as single registrations.
- A cycle cannot have a valid internal disposal order. Services in the cycle start in registration order.
- The graph plan takes `O(V log V + E)` time and `O(V + E)` memory.
- If factory dependency order is important, the application must coordinate cleanup.

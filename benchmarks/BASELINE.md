# Performance baseline

This file records a reference run for the benchmark suite. The production code
matches the base commit below.

- Base commit: `1c4fa59b8751`
- Node.js: `v24.21.0`
- Platform: Apple M3 Max, Darwin arm64
- Recorded: 2026-11-06

The table reports the median `p75` batch time in milliseconds. Each median uses
three suite runs.

| Scenario ID | Size | Operations per sample | `p75` batch (ms) |
| --- | ---: | ---: | ---: |
| container-build | 10 | 200 | 0.7387 |
| container-build | 100 | 25 | 0.7402 |
| container-build | 1000 | 5 | 1.3092 |
| cold-resolve | 10 | 500 | 0.6803 |
| cold-resolve | 100 | 40 | 0.5546 |
| cold-resolve | 400 | 8 | 0.4525 |
| warm-resolve | 10 | 25000 | 0.4222 |
| warm-resolve | 100 | 25000 | 0.4965 |
| warm-resolve | 1000 | 25000 | 0.4634 |
| warm-resolve-constructor | 1 | 25000 | 0.3621 |
| warm-resolve-constructor | 10 | 25000 | 0.3636 |
| warm-resolve-constructor | 100 | 25000 | 0.4037 |
| deep-resolve | 10 | 2500 | 0.9542 |
| deep-resolve | 100 | 100 | 0.7622 |
| deep-resolve | 400 | 10 | 0.3568 |
| start-scope | 10 | 20000 | 0.8803 |
| start-scope | 100 | 20000 | 0.8732 |
| start-scope | 1000 | 20000 | 0.8695 |
| scope-request | 10 | 1000 | 0.6976 |
| scope-request | 100 | 1000 | 0.7260 |
| scope-request | 1000 | 1000 | 0.7180 |
| scope-request-async | 10 | 400 | 0.8173 |
| scope-request-async | 100 | 400 | 0.8087 |
| scope-request-async | 1000 | 400 | 0.8173 |
| get-all | 10 | 10000 | 0.7801 |
| get-all | 100 | 1500 | 1.0588 |
| get-all | 1000 | 150 | 1.2008 |
| sync-dispose | 10 | 200 | 0.7485 |
| sync-dispose | 100 | 40 | 1.0509 |
| sync-dispose | 1000 | 4 | 0.9773 |
| async-dispose | 10 | 200 | 1.4291 |
| async-dispose | 100 | 24 | 1.4936 |
| async-dispose | 1000 | 2 | 1.4257 |
| graph-singleton-roots | 500 | 1 | 0.3049 |
| graph-singleton-roots | 1000 | 1 | 0.6245 |
| graph-singleton-roots | 2000 | 1 | 1.2928 |
| graph-singleton-roots | 4000 | 1 | 2.9486 |
| graph-independent-cycles | 500 | 1 | 0.2663 |
| graph-independent-cycles | 1000 | 1 | 0.5448 |
| graph-independent-cycles | 2000 | 1 | 1.1823 |
| graph-independent-cycles | 4000 | 1 | 2.5517 |

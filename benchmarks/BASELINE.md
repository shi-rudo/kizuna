# Performance baseline

This file records a reference run for the benchmark suite. The production code
matches the base commit below.

- Base commit: `080f67fbbd03`
- Node.js: `v24.11.1`
- Platform: Apple M3 Max, Darwin arm64
- Recorded: 2026-09-04

The table reports the median `p75` batch time in milliseconds. Each median uses
three suite runs.

| Scenario ID | Size | Operations per sample | `p75` batch (ms) |
| --- | ---: | ---: | ---: |
| container-build | 10 | 200 | 0.8948 |
| container-build | 100 | 25 | 0.7340 |
| container-build | 1000 | 5 | 1.3485 |
| cold-resolve | 10 | 500 | 0.4260 |
| cold-resolve | 100 | 40 | 0.9045 |
| cold-resolve | 400 | 8 | 1.3467 |
| warm-resolve | 10 | 25000 | 0.5839 |
| warm-resolve | 100 | 25000 | 0.6580 |
| warm-resolve | 1000 | 25000 | 0.6505 |
| deep-resolve | 10 | 2500 | 1.0470 |
| deep-resolve | 100 | 100 | 1.5426 |
| deep-resolve | 400 | 10 | 1.5535 |
| start-scope | 10 | 1000 | 1.3668 |
| start-scope | 100 | 100 | 1.3276 |
| start-scope | 1000 | 10 | 1.4495 |
| get-all | 10 | 10000 | 0.8516 |
| get-all | 100 | 1500 | 0.9524 |
| get-all | 1000 | 150 | 1.0965 |
| sync-dispose | 10 | 200 | 0.7196 |
| sync-dispose | 100 | 40 | 0.8589 |
| sync-dispose | 1000 | 4 | 0.7960 |
| async-dispose | 10 | 200 | 1.2040 |
| async-dispose | 100 | 24 | 1.3027 |
| async-dispose | 1000 | 2 | 1.1671 |
| graph-singleton-roots | 500 | 1 | 0.3266 |
| graph-singleton-roots | 1000 | 1 | 0.6296 |
| graph-singleton-roots | 2000 | 1 | 1.3609 |
| graph-singleton-roots | 4000 | 1 | 3.3367 |
| graph-independent-cycles | 500 | 1 | 0.2648 |
| graph-independent-cycles | 1000 | 1 | 0.5455 |
| graph-independent-cycles | 2000 | 1 | 1.1467 |
| graph-independent-cycles | 4000 | 1 | 2.5578 |

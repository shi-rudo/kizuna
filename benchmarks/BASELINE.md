# Performance baseline

This file records a reference run for the benchmark suite. The production code
matches the base commit below.

- Base commit: `080f67fbbd03`
- Node.js: `v24.11.1`
- Platform: Apple M3 Max, Darwin arm64
- Recorded: 2026-09-02

The table reports the `p75` time in milliseconds. Run the suite three times and
replace each cell with the median `p75` value from those runs.

| Scenario | Size | `p75` (ms) |
| --- | ---: | ---: |
| Container build | 10 registrations | 0.016542 |
| Container build | 100 registrations | 0.048458 |
| Container build | 1,000 registrations | 0.3465 |
| Synchronous disposal | 10 resolved resources | 0.020083 |
| Synchronous disposal | 100 resolved resources | 0.032334 |
| Synchronous disposal | 1,000 resolved resources | 0.3671 |
| Asynchronous disposal | 10 resolved resources | 0.011083 |
| Asynchronous disposal | 100 resolved resources | 0.085750 |
| Asynchronous disposal | 1,000 resolved resources | 1.1486 |
| Singleton-root validation | 500 nodes | 0.3174 |
| Singleton-root validation | 1,000 nodes | 0.6122 |
| Singleton-root validation | 2,000 nodes | 1.2552 |
| Singleton-root validation | 4,000 nodes | 2.9869 |
| Independent-cycle validation | 500 nodes | 0.2648 |
| Independent-cycle validation | 1,000 nodes | 0.5442 |
| Independent-cycle validation | 2,000 nodes | 1.1548 |
| Independent-cycle validation | 4,000 nodes | 2.4183 |
| Scope creation | 10 registrations | 0.001292 |
| Scope creation | 100 registrations | 0.012458 |
| Scope creation | 1,000 registrations | 0.1403 |
| Multi-resolution | 10 registrations | 0.000125 |
| Multi-resolution | 100 registrations | 0.000875 |
| Multi-resolution | 1,000 registrations | 0.008834 |
| Cold resolve | 10 singleton dependencies | 0.004916 |
| Cold resolve | 100 singleton dependencies | 0.031416 |
| Cold resolve | 400 singleton dependencies | 0.1936 |
| Warm resolve | 10 registrations | 0.000042 |
| Warm resolve | 100 registrations | 0.000042 |
| Warm resolve | 1,000 registrations | 0.000083 |
| Deep resolve | 10 transient dependencies | 0.000458 |
| Deep resolve | 100 transient dependencies | 0.014875 |
| Deep resolve | 400 transient dependencies | 0.1538 |

# Performance benchmarks

These benchmarks measure the main public container operations. Use the results
to find performance changes. Do not compare absolute times from different
machines.

## Scenarios

| Scenario | Measured work |
| --- | --- |
| Container build | Build a prepared container with singleton factories. This includes eager graph validation. |
| Cold resolve | Resolve a new singleton dependency chain for the first time. Pool creation is outside the measurement. |
| Warm resolve | Get one pre-resolved singleton from a container with other registrations. |
| Deep resolve | Resolve a transient dependency chain. Every lookup creates the full chain. |
| Scope creation | Start a scope from a container with singleton, scoped, and transient registrations. |
| Multi-resolution | Get all pre-resolved singleton registrations for one key. |
| Synchronous disposal | Dispose resolved singleton resources with `Symbol.dispose` hooks. Pool creation is outside the measurement. |
| Asynchronous disposal | Dispose resolved singleton resources with `Symbol.asyncDispose` hooks. Pool creation is outside the measurement. |
| Singleton-root validation | Validate many singleton roots that share one scoped dependency. |
| Independent-cycle validation | Validate many small and independent dependency cycles. |

The scenario manifest defines at least three input sizes for each operation. The
graph scenarios use 500, 1,000, 2,000, and 4,000 nodes.

## Measurement method

Vitest runs the benchmark files in sequence. Tinybench warms each task before it
records samples. The container-build, cold-resolution, and disposal tasks use
20 recorded samples. Their setup prepares separate input for every invocation.

The tables report times in milliseconds. Use the `p75` value for comparisons.
It is less sensitive to rare pauses than the maximum value.

Run comparisons on the same machine and Node.js version. Close other busy
programs before each run.

## Run the suite

1. Install the locked dependencies.
2. Run `pnpm benchmark` three times.
3. Record the `p75` value for each scenario and size.
4. Compare each result with the same row in the baseline.

Treat a row as a possible regression when it takes more than 1.5 times the
baseline time. Repeat the three runs on an idle machine. If the increase occurs
again, inspect a performance profile before you accept the change.

For the graph scenarios, compare each size with the preceding size. A doubled
graph has twice as many nodes. If it takes more than 3.5 times longer, repeat
the run on an idle machine. If the result occurs again, inspect the validation
profile.

The committed [baseline](./BASELINE.md) records one reference environment. A
result from another environment is useful only for growth-rate comparisons.

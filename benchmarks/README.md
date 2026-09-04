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

The scenario manifest defines at least three input sizes for each operation. It
also defines the number of operations in one sample. Each benchmark name shows
this batch size. The graph scenarios use one operation in each sample.

## Measurement method

Vitest runs the benchmark files in sequence. Tinybench warms each task before it
records samples. One sample contains enough operations for a measurable time.
This batching decreases timer noise for fast operations.

The container-build, cold-resolution, and disposal tasks use 50 recorded
samples. Their setup prepares a separate input for every operation. The setup
and cleanup times are outside the reported time.

The tables report the batch time in milliseconds. Use the `p75` value for
comparisons. It is less sensitive to rare pauses than the maximum value. Compare
only rows that have the same size and batch size.

Run comparisons on the same machine and Node.js version. Close other busy
programs before each run.

## Run the suite

1. Install the locked dependencies.
2. Run `pnpm benchmark` three times.
3. Record the `p75` batch time for each scenario and size.
4. Calculate the median of the three recorded times.
5. Compare the median with the same row in the baseline.

Treat a row as a possible regression when it takes more than 1.5 times the
baseline time. Repeat the three runs on an idle machine. If the increase occurs
again, inspect a performance profile before you accept the change.

For the graph scenarios, compare each size with the preceding size. A doubled
graph has twice as many nodes. If it takes more than 3.5 times longer, repeat
the run on an idle machine. If the result occurs again, inspect the validation
profile.

The committed [baseline](./BASELINE.md) records one reference environment. A
result from another environment is useful only for growth-rate comparisons.

CI runs the suite once on Node.js 24. This run makes sure that each benchmark is
executable. CI does not apply performance limits because hosted runners vary.

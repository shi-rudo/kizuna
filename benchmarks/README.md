# Graph validation benchmarks

These benchmarks use graph shapes that caused excessive workspace allocation.
One case uses singleton roots with one scoped target. The other case uses
independent dependency cycles.

Each case uses 500, 1,000, 2,000, and 4,000 graph nodes. This size series shows
the growth rate for each graph shape.

Run the benchmark suite:

```bash
pnpm benchmark
```

Compare results from the same machine and Node.js version. Compare the `p75`
time of each size with the `p75` time of the preceding size.

If a doubled graph takes more than 3.5 times longer, repeat the benchmark on an
idle machine. If the result occurs again, examine the validation profile.

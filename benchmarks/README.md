# Graph validation benchmarks

These benchmarks use graph shapes that caused excessive workspace allocation.
One case uses many singleton roots with one scoped target. The other case uses
many independent dependency cycles.

Run the benchmark suite:

```bash
pnpm benchmark
```

Compare results from the same machine and Node.js version. Use several graph
sizes when you examine growth behavior.

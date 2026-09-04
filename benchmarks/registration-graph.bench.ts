import { bench, describe } from "vitest";
import {
	type BenchmarkBuilder,
	benchmarkName,
	createBenchmarkBuilder,
	scenarioCases,
} from "./scenarios";

const manyRoots = (rootCount: number): BenchmarkBuilder => {
	const builder = createBenchmarkBuilder();
	builder.registerScopedFactory("scoped", () => ({}));
	for (let index = 0; index < rootCount; index++) {
		builder.registerSingletonFactory(`root-${index}`, () => ({}), "scoped");
	}
	return builder;
};

const manyCycles = (cycleCount: number): BenchmarkBuilder => {
	const builder = createBenchmarkBuilder();
	for (let index = 0; index < cycleCount; index++) {
		builder
			.registerSingletonFactory(`left-${index}`, () => ({}), `right-${index}`)
			.registerSingletonFactory(`right-${index}`, () => ({}), `left-${index}`);
	}
	return builder;
};

describe("registration graph validation with singleton roots", () => {
	for (const benchmarkCase of scenarioCases("graph-singleton-roots")) {
		const { operationsPerSample, size: nodeCount } = benchmarkCase;
		const roots = manyRoots(nodeCount - 1);
		bench(benchmarkName(benchmarkCase, "nodes"), () => {
			for (let index = 0; index < operationsPerSample; index++) {
				roots.validate();
			}
		});
	}
});

describe("registration graph validation with independent cycles", () => {
	for (const benchmarkCase of scenarioCases("graph-independent-cycles")) {
		const { operationsPerSample, size: nodeCount } = benchmarkCase;
		const cycles = manyCycles(nodeCount / 2);
		bench(benchmarkName(benchmarkCase, "nodes"), () => {
			for (let index = 0; index < operationsPerSample; index++) {
				cycles.validate();
			}
		});
	}
});

import { bench, describe } from "vitest";
import {
	type BenchmarkContainer,
	benchmarkName,
	consume,
	createColdResolutionContainer,
	createDeepResolutionContainer,
	createWarmResolutionContainer,
	preparedSampleCount,
	scenarioCases,
} from "./scenarios";

// Tinybench calls each function once to detect asynchronous work.
// This call is outside the reported samples.
const measuredInvocationCount = preparedSampleCount + 1;

describe("cold resolve", () => {
	for (const benchmarkCase of scenarioCases("cold-resolve")) {
		const { operationsPerSample, size: depth } = benchmarkCase;
		let available: BenchmarkContainer[] = [];

		bench(
			benchmarkName(benchmarkCase, "singleton dependencies"),
			() => {
				let lastResult: unknown;
				for (let index = 0; index < operationsPerSample; index++) {
					const container = available.pop();
					if (!container) {
						throw new Error(
							"Cold resolve benchmark exhausted its container pool",
						);
					}
					lastResult = container.get("node-0");
				}
				consume(lastResult);
			},
			{
				iterations: preparedSampleCount,
				setup: () => {
					available = Array.from(
						{ length: measuredInvocationCount * operationsPerSample },
						() => createColdResolutionContainer(depth),
					);
				},
				teardown: () => {
					for (const container of available) {
						container.dispose();
					}
				},
				time: 0,
				warmupIterations: 5,
				warmupTime: 0,
			},
		);
	}
});

describe("warm resolve", () => {
	for (const benchmarkCase of scenarioCases("warm-resolve")) {
		const { operationsPerSample, size: registrationCount } = benchmarkCase;
		const container = createWarmResolutionContainer(registrationCount);
		bench(benchmarkName(benchmarkCase, "registrations"), () => {
			let lastResult: unknown;
			for (let index = 0; index < operationsPerSample; index++) {
				lastResult = container.get("target");
			}
			consume(lastResult);
		});
	}
});

describe("deep resolve", () => {
	for (const benchmarkCase of scenarioCases("deep-resolve")) {
		const { operationsPerSample, size: depth } = benchmarkCase;
		const container = createDeepResolutionContainer(depth);
		bench(benchmarkName(benchmarkCase, "transient dependencies"), () => {
			let lastResult: unknown;
			for (let index = 0; index < operationsPerSample; index++) {
				lastResult = container.get("node-0");
			}
			consume(lastResult);
		});
	}
});

import { bench, describe } from "vitest";
import {
	type BenchmarkContainer,
	benchmarkName,
	createDisposableContainer,
	preparedSampleCount,
	scenarioCases,
} from "./scenarios";

// Tinybench calls each function once to detect asynchronous work.
// This call is outside the reported samples.
const measuredInvocationCount = preparedSampleCount + 1;

describe("synchronous disposal", () => {
	for (const benchmarkCase of scenarioCases("sync-dispose")) {
		const { operationsPerSample, size: registrationCount } = benchmarkCase;
		let available: BenchmarkContainer[] = [];
		bench(
			benchmarkName(benchmarkCase, "resolved resources"),
			() => {
				for (let index = 0; index < operationsPerSample; index++) {
					const container = available.pop();
					if (!container) {
						throw new Error("Disposal benchmark exhausted its container pool");
					}
					container.dispose();
				}
			},
			{
				iterations: preparedSampleCount,
				setup: () => {
					available = Array.from(
						{ length: measuredInvocationCount * operationsPerSample },
						() => createDisposableContainer(registrationCount, "sync"),
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

describe("asynchronous disposal", () => {
	for (const benchmarkCase of scenarioCases("async-dispose")) {
		const { operationsPerSample, size: registrationCount } = benchmarkCase;
		let available: BenchmarkContainer[] = [];
		bench(
			benchmarkName(benchmarkCase, "resolved resources"),
			async () => {
				for (let index = 0; index < operationsPerSample; index++) {
					const container = available.pop();
					if (!container) {
						throw new Error("Disposal benchmark exhausted its container pool");
					}
					await container.disposeAsync();
				}
			},
			{
				iterations: preparedSampleCount,
				setup: () => {
					available = Array.from(
						{ length: measuredInvocationCount * operationsPerSample },
						() => createDisposableContainer(registrationCount, "async"),
					);
				},
				teardown: async () => {
					await Promise.all(
						available.map((container) => container.disposeAsync()),
					);
				},
				time: 0,
				warmupIterations: 5,
				warmupTime: 0,
			},
		);
	}
});

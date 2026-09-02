import { bench, describe } from "vitest";
import {
	type BenchmarkContainer,
	createDisposableContainer,
	scenarioSizes,
} from "./scenarios";

const disposalSampleCount = 20;
// Tinybench calls each function once to detect asynchronous work.
// This call is outside the reported samples.
const disposalInvocationCount = disposalSampleCount + 1;

describe("synchronous disposal", () => {
	for (const registrationCount of scenarioSizes("sync-dispose")) {
		let available: BenchmarkContainer[] = [];
		bench(
			`${registrationCount} resolved resources`,
			() => {
				const container = available.pop();
				if (!container) {
					throw new Error("Disposal benchmark exhausted its container pool");
				}
				container.dispose();
			},
			{
				iterations: disposalSampleCount,
				setup: () => {
					available = Array.from({ length: disposalInvocationCount }, () =>
						createDisposableContainer(registrationCount, "sync"),
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
	for (const registrationCount of scenarioSizes("async-dispose")) {
		let available: BenchmarkContainer[] = [];
		bench(
			`${registrationCount} resolved resources`,
			async () => {
				const container = available.pop();
				if (!container) {
					throw new Error("Disposal benchmark exhausted its container pool");
				}
				await container.disposeAsync();
			},
			{
				iterations: disposalSampleCount,
				setup: () => {
					available = Array.from({ length: disposalInvocationCount }, () =>
						createDisposableContainer(registrationCount, "async"),
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

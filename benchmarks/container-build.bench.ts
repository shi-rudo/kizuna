import { bench, describe } from "vitest";
import {
	type BenchmarkBuilder,
	type BenchmarkContainer,
	consume,
	createSingletonBuilder,
	scenarioSizes,
} from "./scenarios";

const buildSampleCount = 20;
// Tinybench calls each function once to detect asynchronous work.
// This call is outside the reported samples.
const buildInvocationCount = buildSampleCount + 1;

describe("container build", () => {
	for (const registrationCount of scenarioSizes("container-build")) {
		let available: BenchmarkBuilder[] = [];
		let built: BenchmarkContainer[] = [];
		bench(
			`${registrationCount} registrations`,
			() => {
				const builder = available.pop();
				if (!builder) {
					throw new Error(
						"Container build benchmark exhausted its builder pool",
					);
				}
				const container = builder.build();
				built.push(container);
				consume(container);
			},
			{
				iterations: buildSampleCount,
				setup: () => {
					available = Array.from({ length: buildInvocationCount }, () =>
						createSingletonBuilder(registrationCount),
					);
					built = [];
				},
				teardown: () => {
					for (const container of built) {
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

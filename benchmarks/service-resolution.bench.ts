import { bench, describe } from "vitest";
import {
	type BenchmarkContainer,
	consume,
	createColdResolutionContainer,
	createDeepResolutionContainer,
	createWarmResolutionContainer,
	scenarioSizes,
} from "./scenarios";

const coldSampleCount = 20;
// Tinybench calls each function once to detect asynchronous work.
// This call is outside the reported samples.
const coldInvocationCount = coldSampleCount + 1;

describe("cold resolve", () => {
	for (const depth of scenarioSizes("cold-resolve")) {
		let available: BenchmarkContainer[] = [];
		let used: BenchmarkContainer[] = [];

		bench(
			`${depth} singleton dependencies`,
			() => {
				const container = available.pop();
				if (!container) {
					throw new Error(
						"Cold resolve benchmark exhausted its container pool",
					);
				}
				used.push(container);
				consume(container.get("node-0"));
			},
			{
				iterations: coldSampleCount,
				setup: () => {
					available = Array.from({ length: coldInvocationCount }, () =>
						createColdResolutionContainer(depth),
					);
					used = [];
				},
				teardown: () => {
					for (const container of [...available, ...used]) {
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
	for (const registrationCount of scenarioSizes("warm-resolve")) {
		const container = createWarmResolutionContainer(registrationCount);
		bench(`${registrationCount} registrations`, () => {
			consume(container.get("target"));
		});
	}
});

describe("deep resolve", () => {
	for (const depth of scenarioSizes("deep-resolve")) {
		const container = createDeepResolutionContainer(depth);
		bench(`${depth} transient dependencies`, () => {
			consume(container.get("node-0"));
		});
	}
});

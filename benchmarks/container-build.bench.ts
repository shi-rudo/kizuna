import { bench, describe } from "vitest";
import {
	type BenchmarkBuilder,
	type BenchmarkContainer,
	benchmarkName,
	consume,
	createSingletonBuilder,
	preparedSampleCount,
	scenarioCases,
} from "./scenarios";

// Tinybench calls each function once to detect asynchronous work.
// This call is outside the reported samples.
const measuredInvocationCount = preparedSampleCount + 1;

describe("container build", () => {
	for (const benchmarkCase of scenarioCases("container-build")) {
		const { operationsPerSample, size: registrationCount } = benchmarkCase;
		let available: BenchmarkBuilder[] = [];
		bench(
			benchmarkName(benchmarkCase, "registrations"),
			() => {
				let lastContainer: BenchmarkContainer | undefined;
				for (let index = 0; index < operationsPerSample; index++) {
					const builder = available.pop();
					if (!builder) {
						throw new Error(
							"Container build benchmark exhausted its builder pool",
						);
					}
					lastContainer = builder.build();
				}
				consume(lastContainer);
			},
			{
				iterations: preparedSampleCount,
				setup: () => {
					available = Array.from(
						{ length: measuredInvocationCount * operationsPerSample },
						() => createSingletonBuilder(registrationCount),
					);
				},
				time: 0,
				warmupIterations: 5,
				warmupTime: 0,
			},
		);
	}
});

import { bench, describe } from "vitest";
import {
	benchmarkName,
	consume,
	createMultiResolutionContainer,
	createScopeContainer,
	scenarioCases,
} from "./scenarios";

describe("scope creation", () => {
	for (const benchmarkCase of scenarioCases("start-scope")) {
		const { operationsPerSample, size: registrationCount } = benchmarkCase;
		const container = createScopeContainer(registrationCount);
		bench(benchmarkName(benchmarkCase, "registrations"), () => {
			let lastScope: unknown;
			for (let index = 0; index < operationsPerSample; index++) {
				lastScope = container.startScope();
			}
			consume(lastScope);
		});
	}
});

describe("multi-resolution", () => {
	for (const benchmarkCase of scenarioCases("get-all")) {
		const { operationsPerSample, size: registrationCount } = benchmarkCase;
		const container = createMultiResolutionContainer(registrationCount);
		bench(benchmarkName(benchmarkCase, "registrations"), () => {
			let lastResult: unknown;
			for (let index = 0; index < operationsPerSample; index++) {
				lastResult = container.getAll("items");
			}
			consume(lastResult);
		});
	}
});

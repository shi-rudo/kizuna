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

describe("scope request", () => {
	for (const benchmarkCase of scenarioCases("scope-request")) {
		const { operationsPerSample, size: registrationCount } = benchmarkCase;
		const container = createScopeContainer(registrationCount);
		bench(benchmarkName(benchmarkCase, "registrations"), () => {
			let lastResult: unknown;
			for (let index = 0; index < operationsPerSample; index++) {
				const scope = container.startScope();
				scope.get("service-0");
				scope.get("service-1");
				lastResult = scope.get("service-2");
				scope.dispose();
			}
			consume(lastResult);
		});
	}
});

describe("asynchronous scope request", () => {
	for (const benchmarkCase of scenarioCases("scope-request-async")) {
		const { operationsPerSample, size: registrationCount } = benchmarkCase;
		const container = createScopeContainer(registrationCount);
		bench(benchmarkName(benchmarkCase, "registrations"), async () => {
			let lastResult: unknown;
			for (let index = 0; index < operationsPerSample; index++) {
				const scope = container.startScope();
				scope.get("service-0");
				scope.get("service-1");
				lastResult = scope.get("service-2");
				await scope.disposeAsync();
			}
			consume(lastResult);
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

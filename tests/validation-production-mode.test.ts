import { afterEach, describe, expect, it, vi } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";

class Logger {
	log(message: string) {
		return message;
	}
}

class UserService {
	constructor(public logger: Logger) {}
}

const validateMissingDependency = () =>
	new ContainerBuilder()
		.registerSingleton("UserService", UserService, "Logger" as never)
		.validate();

describe("deterministic graph validation", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("returns the same issue in development and production", () => {
		vi.stubEnv("NODE_ENV", "development");
		const developmentIssues = validateMissingDependency();

		vi.stubEnv("NODE_ENV", "production");
		const productionIssues = validateMissingDependency();

		expect(productionIssues).toEqual(developmentIssues);
		expect(productionIssues[0]).toMatchObject({
			code: "MISSING_DEPENDENCY",
			dependencyKey: "Logger",
			path: ["UserService", "Logger"],
		});
	});

	it("returns the same issue when process is unavailable", () => {
		const nodeIssues = validateMissingDependency();

		vi.stubGlobal("process", undefined);

		expect(validateMissingDependency()).toEqual(nodeIssues);
	});

	it("does not infer dependency keys from parameter names", () => {
		const issues = new ContainerBuilder()
			.registerSingleton("DifferentKey", Logger)
			.registerSingleton("UserService", UserService, "DifferentKey")
			.validate();

		expect(issues).toEqual([]);
	});

	it("detects cycles without environment checks", () => {
		class A {
			constructor(public b: B) {}
		}
		class B {
			constructor(public a: A) {}
		}

		vi.stubGlobal("process", undefined);

		const issues = new ContainerBuilder()
			.registerSingleton("A", A, "B" as never)
			.registerSingleton("B", B, "A")
			.validate();

		expect(issues).toContainEqual(
			expect.objectContaining({
				code: "CIRCULAR_DEPENDENCY",
				path: ["A", "B", "A"],
			}),
		);
	});
});

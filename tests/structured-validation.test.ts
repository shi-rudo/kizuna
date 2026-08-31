import { afterEach, describe, expect, it, vi } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";
import { createValidationIssue } from "../src/api/validation";

class Leaf {}

class Consumer {
	constructor(public dependency: Leaf) {}
}

describe("structured container validation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("reports a missing dependency with a stable code and path", () => {
		const issues = new ContainerBuilder()
			.registerSingleton("consumer", Consumer, "missing" as never)
			.validate();

		expect(issues).toEqual([
			{
				code: "MISSING_DEPENDENCY",
				dependencyKey: "missing",
				message: "Service 'consumer' depends on unregistered service 'missing'",
				path: ["consumer", "missing"],
				pathSegments: [{ key: "consumer" }, { key: "missing" }],
				serviceKey: "consumer",
			},
		]);
		expect(Object.isFrozen(issues)).toBe(true);
		expect(Object.isFrozen(issues[0])).toBe(true);
		expect(Object.isFrozen(issues[0]?.path)).toBe(true);
		expect(Object.isFrozen(issues[0]?.pathSegments)).toBe(true);
		expect(Object.isFrozen(issues[0]?.pathSegments[0])).toBe(true);
	});

	it("derives the legacy path from structured path segments", () => {
		const issue = createValidationIssue({
			code: "MISSING_DEPENDENCY",
			dependencyKey: "missing",
			message: "Missing dependency",
			pathSegments: [{ key: "consumer" }, { key: "missing" }],
			serviceKey: "consumer",
		});

		expect(issue.path).toEqual(["consumer", "missing"]);
	});

	it("reports circular and captive paths as structured issues", () => {
		class A {
			constructor(public b: unknown) {}
		}
		class B {
			constructor(public a: unknown) {}
		}

		const cycleIssues = new ContainerBuilder()
			.registerSingleton("a", A, "b" as never)
			.registerSingleton("b", B, "a")
			.validate();

		expect(cycleIssues).toContainEqual(
			expect.objectContaining({
				code: "CIRCULAR_DEPENDENCY",
				path: ["a", "b", "a"],
				serviceKey: "a",
			}),
		);

		const captiveIssues = new ContainerBuilder()
			.registerScoped("leaf", Leaf)
			.registerTransient("bridge", Consumer, "leaf")
			.registerSingleton("root", Consumer, "bridge")
			.validate();

		expect(captiveIssues).toContainEqual(
			expect.objectContaining({
				code: "CAPTIVE_DEPENDENCY",
				dependencyKey: "leaf",
				path: ["root", "bridge", "leaf"],
				serviceKey: "root",
			}),
		);
	});

	it("rejects an invalid graph before it creates a provider", () => {
		const builder = new ContainerBuilder().registerSingleton(
			"consumer",
			Consumer,
			"missing" as never,
		);

		expect(() => builder.build()).toThrow(
			expect.objectContaining({
				code: "CONTAINER_VALIDATION_FAILED",
				issues: [
					expect.objectContaining({
						code: "MISSING_DEPENDENCY",
						path: ["consumer", "missing"],
					}),
				],
				name: "ContainerValidationError",
			}),
		);
	});

	it("keeps a builder mutable after a failed build", () => {
		const builder = new ContainerBuilder().registerSingleton(
			"consumer",
			Consumer,
			"leaf" as never,
		);

		expect(() => builder.build()).toThrow();

		builder.registerSingleton("leaf", Leaf);

		expect(builder.build().get("consumer")).toBeInstanceOf(Consumer);
	});

	it("allows validation to be deferred explicitly", () => {
		const container = new ContainerBuilder()
			.registerSingleton("consumer", Consumer, "missing" as never)
			.build({ validation: "deferred" });

		expect(() => container.get("consumer")).toThrow(
			/No service registered for key: missing/,
		);
	});

	it("does not inspect constructor parameter names in any runtime", () => {
		class RuntimeConsumer {
			constructor(public differentParameterName: Leaf) {}
		}

		const validate = () =>
			new ContainerBuilder()
				.registerSingleton("leaf", Leaf)
				.registerSingleton("consumer", RuntimeConsumer, "leaf")
				.validate();

		expect(validate()).toEqual([]);

		vi.stubGlobal("process", undefined);

		expect(validate()).toEqual([]);
	});
});

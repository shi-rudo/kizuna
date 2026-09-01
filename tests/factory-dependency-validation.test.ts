import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";

class ScopedDependency {}

describe("factory dependency metadata", () => {
	it("reports a declared missing dependency", () => {
		const issues = new ContainerBuilder()
			.registerSingletonFactory(
				"consumer",
				() => ({ value: true }),
				"missing" as never,
			)
			.validate();

		expect(issues).toContainEqual(
			expect.objectContaining({
				code: "MISSING_DEPENDENCY",
				dependencyKey: "missing",
				path: ["consumer", "missing"],
				serviceKey: "consumer",
			}),
		);
	});

	it("reports a captive dependency through a declared factory edge", () => {
		const issues = new ContainerBuilder()
			.registerScoped("dependency", ScopedDependency)
			.registerTransientFactory(
				"bridge",
				(provider) => provider.get("dependency"),
				"dependency",
			)
			.registerSingletonFactory(
				"consumer",
				(provider) => provider.get("bridge"),
				"bridge",
			)
			.validate();

		expect(issues).toContainEqual(
			expect.objectContaining({
				code: "CAPTIVE_DEPENDENCY",
				dependencyKey: "dependency",
				path: ["consumer", "bridge", "dependency"],
				serviceKey: "consumer",
			}),
		);
	});

	it("reports a cycle through declared factory edges", () => {
		const issues = new ContainerBuilder()
			.registerSingletonFactory(
				"first",
				(provider) => provider.get("second" as never),
				"second" as never,
			)
			.registerSingletonFactory(
				"second",
				(provider) => provider.get("first"),
				"first",
			)
			.validate();

		expect(issues).toContainEqual(
			expect.objectContaining({
				code: "CIRCULAR_DEPENDENCY",
				path: ["first", "second", "first"],
				serviceKey: "first",
			}),
		);
	});

	it("uses declared factory edges for disposal order", () => {
		const events: string[] = [];
		const container = new ContainerBuilder()
			.registerSingletonFactory("dependency", () => ({
				dispose: () => events.push("dependency"),
			}))
			.registerSingletonFactory(
				"consumer",
				(provider) => ({
					dependency: provider.get("dependency"),
					dispose: () => events.push("consumer"),
				}),
				"dependency",
			)
			.build();

		container.get("consumer");
		container.dispose();

		expect(events).toEqual(["consumer", "dependency"]);
	});

	it("records dependencies for multi-factory registrations", () => {
		const issues = new ContainerBuilder()
			.addSingletonFactory(
				"consumers",
				() => ({ value: true }),
				"missing" as never,
			)
			.validate();

		expect(issues).toContainEqual(
			expect.objectContaining({
				code: "MISSING_DEPENDENCY",
				dependencyKey: "missing",
				serviceKey: "consumers",
			}),
		);
	});
});

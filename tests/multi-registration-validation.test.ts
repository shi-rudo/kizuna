import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";

class Leaf {}

class Consumer {
	constructor(public dependency: unknown) {}
}

describe("multi-registration graph validation", () => {
	it("reports each missing dependency with its registration index", () => {
		const issues = new ContainerBuilder()
			.addSingleton("consumers", Consumer, "firstMissing" as never)
			.addSingleton("consumers", Consumer, "secondMissing" as never)
			.validate()
			.filter((issue) => issue.code === "MISSING_DEPENDENCY");

		expect(issues).toEqual([
			expect.objectContaining({
				dependencyKey: "firstMissing",
				registrationIndex: 0,
				serviceKey: "consumers",
			}),
			expect.objectContaining({
				dependencyKey: "secondMissing",
				registrationIndex: 1,
				serviceKey: "consumers",
			}),
		]);
	});

	it("reports each captive multi-registration root separately", () => {
		const issues = new ContainerBuilder()
			.registerScoped("dependency", Leaf)
			.addSingleton("consumers", Consumer, "dependency")
			.addSingleton("consumers", Consumer, "dependency")
			.validate()
			.filter((issue) => issue.code === "CAPTIVE_DEPENDENCY");

		expect(issues).toEqual([
			expect.objectContaining({
				path: ["consumers", "dependency"],
				registrationIndex: 0,
			}),
			expect.objectContaining({
				path: ["consumers", "dependency"],
				registrationIndex: 1,
			}),
		]);
	});

	it("identifies the captive dependency registration in a multi-key", () => {
		const issues = new ContainerBuilder()
			.addSingleton("dependencies", Leaf)
			.addScoped("dependencies", Leaf)
			.registerSingleton("consumer", Consumer, "dependencies")
			.validate()
			.filter((issue) => issue.code === "CAPTIVE_DEPENDENCY");

		expect(issues).toContainEqual(
			expect.objectContaining({
				dependencyKey: "dependencies",
				dependencyRegistrationIndex: 1,
				path: ["consumer", "dependencies"],
			}),
		);
	});

	it("identifies the multi-registration that closes a cycle", () => {
		const issues = new ContainerBuilder()
			.addSingleton("first", Consumer, "second" as never)
			.addSingleton("first", Leaf)
			.addSingleton("second", Consumer, "first")
			.validate()
			.filter((issue) => issue.code === "CIRCULAR_DEPENDENCY");

		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ["first", "second", "first"],
				registrationIndex: 0,
				serviceKey: "first",
			}),
		);
	});

	it("preserves an intermediate multi-registration identity in a cycle path", () => {
		const issues = new ContainerBuilder()
			.registerSingleton("root", Consumer, "group" as never)
			.addSingleton("group", Leaf)
			.addSingleton("group", Consumer, "root")
			.validate()
			.filter((issue) => issue.code === "CIRCULAR_DEPENDENCY");

		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ["root", "group", "root"],
				pathSegments: [
					{ key: "root" },
					{ key: "group", registrationIndex: 1 },
					{ key: "root" },
				],
			}),
		);
	});

	it("preserves an intermediate multi-registration identity in a captive path", () => {
		const issues = new ContainerBuilder()
			.registerScoped("scoped", Leaf)
			.addTransient("group", Leaf)
			.addTransient("group", Consumer, "scoped")
			.registerSingleton("root", Consumer, "group")
			.validate()
			.filter((issue) => issue.code === "CAPTIVE_DEPENDENCY");

		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ["root", "group", "scoped"],
				pathSegments: [
					{ key: "root" },
					{ key: "group", registrationIndex: 1 },
					{ key: "scoped" },
				],
			}),
		);
	});
});

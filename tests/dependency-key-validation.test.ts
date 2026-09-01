import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";

class Dependency {}

const invalidDependencyKeys = [
	undefined,
	null,
	42,
	Symbol("dependency"),
	{},
	"",
	"   ",
] as const;

describe("dependency key validation", () => {
	it.each(
		invalidDependencyKeys,
	)("rejects the invalid factory dependency key %s at registration time", (dependencyKey) => {
		expect(() =>
			new ContainerBuilder().registerSingletonFactory(
				"consumer",
				() => ({}),
				dependencyKey as never,
			),
		).toThrow(
			expect.objectContaining({
				message:
					"Dependency at index 0 for service 'consumer' must be a non-empty string",
				name: "TypeError",
			}),
		);
	});

	it("rejects an invalid constructor dependency key", () => {
		expect(() =>
			new ContainerBuilder().registerSingleton(
				"consumer",
				Dependency,
				Symbol("dependency") as never,
			),
		).toThrow(TypeError);
	});

	it("rejects an invalid multi-factory dependency key", () => {
		expect(() =>
			new ContainerBuilder().addSingletonFactory(
				"consumers",
				() => ({}),
				null as never,
			),
		).toThrow(TypeError);
	});
});

import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";
import type { ValidationIssue } from "../src/api/validation";

interface DynamicBuilder {
	registerSingletonFactory(
		key: string,
		factory: () => unknown,
		...dependencies: string[]
	): DynamicBuilder;
	registerScopedFactory(
		key: string,
		factory: () => unknown,
		...dependencies: string[]
	): DynamicBuilder;
	registerTransientFactory(
		key: string,
		factory: () => unknown,
		...dependencies: string[]
	): DynamicBuilder;
	validate(): readonly ValidationIssue[];
}

const dynamicBuilder = (): DynamicBuilder =>
	new ContainerBuilder() as unknown as DynamicBuilder;

describe("registration graph scale", () => {
	it("reports one captive dependency for each singleton root", () => {
		const builder = dynamicBuilder();
		const rootCount = 200;
		builder.registerScopedFactory("scoped", () => ({}));
		for (let index = 0; index < rootCount; index++) {
			builder.registerSingletonFactory(`root-${index}`, () => ({}), "scoped");
		}

		const issues = builder.validate();
		expect(issues).toHaveLength(rootCount);
		expect(issues.every((issue) => issue.code === "CAPTIVE_DEPENDENCY")).toBe(
			true,
		);
	});

	it("reports one circular dependency for each independent cycle", () => {
		const builder = dynamicBuilder();
		const cycleCount = 100;
		for (let index = 0; index < cycleCount; index++) {
			builder
				.registerSingletonFactory(`left-${index}`, () => ({}), `right-${index}`)
				.registerSingletonFactory(
					`right-${index}`,
					() => ({}),
					`left-${index}`,
				);
		}

		const issues = builder.validate();
		expect(issues).toHaveLength(cycleCount);
		expect(issues.every((issue) => issue.code === "CIRCULAR_DEPENDENCY")).toBe(
			true,
		);
	});

	it("validates a 10,000-node singleton chain without a stack overflow", () => {
		const builder = dynamicBuilder();
		const nodeCount = 10_000;

		for (let index = 0; index < nodeCount; index++) {
			const dependencies = index + 1 < nodeCount ? [`node-${index + 1}`] : [];
			builder.registerSingletonFactory(
				`node-${index}`,
				() => ({}),
				...dependencies,
			);
		}

		expect(builder.validate()).toEqual([]);
	});

	it("reports each scoped leaf in a dense acyclic graph", () => {
		const builder = dynamicBuilder();
		const width = 3;
		const layerCount = 15;
		const keysInLayer = (layer: number): string[] =>
			Array.from({ length: width }, (_, index) => `layer-${layer}-${index}`);

		builder.registerSingletonFactory("root", () => ({}), ...keysInLayer(0));
		for (let layer = 0; layer < layerCount; layer++) {
			const dependencies = layer + 1 < layerCount ? keysInLayer(layer + 1) : [];
			for (const key of keysInLayer(layer)) {
				if (layer + 1 === layerCount) {
					builder.registerScopedFactory(key, () => ({}));
				} else {
					builder.registerTransientFactory(key, () => ({}), ...dependencies);
				}
			}
		}

		const issues = builder.validate();
		expect(issues).toHaveLength(width);
		expect(issues.every((issue) => issue.code === "CAPTIVE_DEPENDENCY")).toBe(
			true,
		);
	});
});

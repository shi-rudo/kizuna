import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";
import type { ValidationIssue } from "../src/api/validation";

interface DynamicBuilder {
	registerSingletonFactory(
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
	it("validates a 10,000-node dependency chain without overflowing the stack", () => {
		const builder = dynamicBuilder();
		const nodeCount = 10_000;

		for (let index = 0; index < nodeCount; index++) {
			const dependencies = index + 1 < nodeCount ? [`node-${index + 1}`] : [];
			builder.registerTransientFactory(
				`node-${index}`,
				() => ({}),
				...dependencies,
			);
		}

		expect(builder.validate()).toEqual([]);
	});

	it("validates a dense acyclic graph without traversing every path", () => {
		const builder = dynamicBuilder();
		const width = 3;
		const layerCount = 15;
		const keysInLayer = (layer: number): string[] =>
			Array.from({ length: width }, (_, index) => `layer-${layer}-${index}`);

		builder.registerSingletonFactory("root", () => ({}), ...keysInLayer(0));
		for (let layer = 0; layer < layerCount; layer++) {
			const dependencies = layer + 1 < layerCount ? keysInLayer(layer + 1) : [];
			for (const key of keysInLayer(layer)) {
				builder.registerTransientFactory(key, () => ({}), ...dependencies);
			}
		}

		const startedAt = performance.now();
		expect(builder.validate()).toEqual([]);
		expect(performance.now() - startedAt).toBeLessThan(1_000);
	});
});

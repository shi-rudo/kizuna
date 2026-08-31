import { afterEach, describe, expect, it, vi } from "vitest";
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

const measureTraversalCells = (operation: () => readonly ValidationIssue[]) => {
	const NativeUint8Array = globalThis.Uint8Array;
	const NativeUint32Array = globalThis.Uint32Array;
	const NativeInt32Array = globalThis.Int32Array;
	let allocatedCells = 0;

	class CountingUint8Array extends NativeUint8Array {
		constructor(length: number) {
			super(length);
			allocatedCells += length;
		}
	}

	class CountingUint32Array extends NativeUint32Array {
		constructor(length: number) {
			super(length);
			allocatedCells += length;
		}
	}

	class CountingInt32Array extends NativeInt32Array {
		constructor(length: number) {
			super(length);
			allocatedCells += length;
		}
	}

	vi.stubGlobal("Uint8Array", CountingUint8Array);
	vi.stubGlobal("Uint32Array", CountingUint32Array);
	vi.stubGlobal("Int32Array", CountingInt32Array);

	return { allocatedCells: () => allocatedCells, issues: operation() };
};

describe("registration graph scale", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses linear traversal storage for many singleton roots", () => {
		const builder = dynamicBuilder();
		const rootCount = 200;
		builder.registerScopedFactory("scoped", () => ({}));
		for (let index = 0; index < rootCount; index++) {
			builder.registerSingletonFactory(`root-${index}`, () => ({}), "scoped");
		}

		const measurement = measureTraversalCells(() => builder.validate());

		expect(measurement.issues).toHaveLength(rootCount);
		expect(measurement.allocatedCells()).toBeLessThanOrEqual(
			(rootCount + 1) * 5,
		);
	});

	it("uses linear traversal storage for many independent cycles", () => {
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

		const measurement = measureTraversalCells(() => builder.validate());

		expect(measurement.issues).toHaveLength(cycleCount);
		expect(measurement.allocatedCells()).toBeLessThanOrEqual(cycleCount * 10);
	});

	it("validates a 10,000-node singleton chain without scanning every pair", () => {
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

	it("finds scoped leaves in a dense acyclic graph without traversing every path", () => {
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

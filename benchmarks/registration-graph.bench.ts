import { bench, describe } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";

interface DynamicBuilder {
	registerScopedFactory(
		key: string,
		factory: () => unknown,
		...dependencies: string[]
	): DynamicBuilder;
	registerSingletonFactory(
		key: string,
		factory: () => unknown,
		...dependencies: string[]
	): DynamicBuilder;
	validate(): readonly unknown[];
}

const manyRoots = (rootCount: number): DynamicBuilder => {
	const builder = new ContainerBuilder() as unknown as DynamicBuilder;
	builder.registerScopedFactory("scoped", () => ({}));
	for (let index = 0; index < rootCount; index++) {
		builder.registerSingletonFactory(`root-${index}`, () => ({}), "scoped");
	}
	return builder;
};

const manyCycles = (cycleCount: number): DynamicBuilder => {
	const builder = new ContainerBuilder() as unknown as DynamicBuilder;
	for (let index = 0; index < cycleCount; index++) {
		builder
			.registerSingletonFactory(`left-${index}`, () => ({}), `right-${index}`)
			.registerSingletonFactory(`right-${index}`, () => ({}), `left-${index}`);
	}
	return builder;
};

const graphSizes = [500, 1_000, 2_000, 4_000] as const;

describe("registration graph validation with singleton roots", () => {
	for (const nodeCount of graphSizes) {
		const roots = manyRoots(nodeCount - 1);
		bench(`${nodeCount} nodes`, () => {
			roots.validate();
		});
	}
});

describe("registration graph validation with independent cycles", () => {
	for (const nodeCount of graphSizes) {
		const cycles = manyCycles(nodeCount / 2);
		bench(`${nodeCount} nodes`, () => {
			cycles.validate();
		});
	}
});

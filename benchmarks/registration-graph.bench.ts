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

describe("registration graph validation", () => {
	const roots = manyRoots(1_000);
	const cycles = manyCycles(500);

	bench("1,000 singleton roots with one scoped target", () => {
		roots.validate();
	});

	bench("500 independent two-node cycles", () => {
		cycles.validate();
	});
});

import { ContainerBuilder } from "../src/api/container-builder";

export const benchmarkScenarios = Object.freeze({
	"container-build": Object.freeze([10, 100, 1_000]),
	"cold-resolve": Object.freeze([10, 100, 400]),
	"warm-resolve": Object.freeze([10, 100, 1_000]),
	"deep-resolve": Object.freeze([10, 100, 400]),
	"start-scope": Object.freeze([10, 100, 1_000]),
	"get-all": Object.freeze([10, 100, 1_000]),
	"sync-dispose": Object.freeze([10, 100, 1_000]),
	"async-dispose": Object.freeze([10, 100, 1_000]),
	"graph-singleton-roots": Object.freeze([500, 1_000, 2_000, 4_000]),
	"graph-independent-cycles": Object.freeze([500, 1_000, 2_000, 4_000]),
});

export type BenchmarkScenario = keyof typeof benchmarkScenarios;

export const scenarioSizes = <TScenario extends BenchmarkScenario>(
	scenario: TScenario,
): (typeof benchmarkScenarios)[TScenario] => benchmarkScenarios[scenario];

export interface BenchmarkContainer {
	get(key: string): unknown;
	getAll(key: string): unknown[];
	startScope(): BenchmarkContainer;
	dispose(): void;
	disposeAsync(): Promise<void>;
}

type BenchmarkFactory = (provider: BenchmarkContainer) => unknown;

export interface BenchmarkBuilder {
	registerSingletonFactory(
		key: string,
		factory: BenchmarkFactory,
		...dependencies: string[]
	): BenchmarkBuilder;
	registerScopedFactory(
		key: string,
		factory: BenchmarkFactory,
		...dependencies: string[]
	): BenchmarkBuilder;
	registerTransientFactory(
		key: string,
		factory: BenchmarkFactory,
		...dependencies: string[]
	): BenchmarkBuilder;
	addSingletonFactory(
		key: string,
		factory: BenchmarkFactory,
		...dependencies: string[]
	): BenchmarkBuilder;
	build(): BenchmarkContainer;
}

const dynamicBuilder = (): BenchmarkBuilder =>
	new ContainerBuilder() as unknown as BenchmarkBuilder;

const staticValue = Object.freeze({ value: 1 });
let _benchmarkSink: unknown;
let _disposalCount = 0;

export const consume = (value: unknown): void => {
	_benchmarkSink = value;
};

export const createSingletonBuilder = (
	registrationCount: number,
): BenchmarkBuilder => {
	const builder = dynamicBuilder();
	for (let index = 0; index < registrationCount; index++) {
		builder.registerSingletonFactory(`service-${index}`, () => staticValue);
	}
	return builder;
};

export const createWarmResolutionContainer = (
	registrationCount: number,
): BenchmarkContainer => {
	const builder = dynamicBuilder().registerSingletonFactory(
		"target",
		() => staticValue,
	);
	for (let index = 1; index < registrationCount; index++) {
		builder.registerSingletonFactory(`background-${index}`, () => staticValue);
	}
	const container = builder.build();
	container.get("target");
	return container;
};

const createDependencyChain = (
	depth: number,
	lifetime: "singleton" | "transient",
): BenchmarkContainer => {
	const builder = dynamicBuilder();
	for (let index = depth - 1; index >= 0; index--) {
		const key = `node-${index}`;
		const dependencyKey = index + 1 < depth ? `node-${index + 1}` : undefined;
		const factory: BenchmarkFactory = dependencyKey
			? (provider) => {
					const dependency = provider.get(dependencyKey) as { depth: number };
					return { depth: dependency.depth + 1 };
				}
			: () => ({ depth: 1 });
		const dependencies = dependencyKey ? [dependencyKey] : [];
		if (lifetime === "singleton") {
			builder.registerSingletonFactory(key, factory, ...dependencies);
		} else {
			builder.registerTransientFactory(key, factory, ...dependencies);
		}
	}
	return builder.build();
};

export const createColdResolutionContainer = (
	depth: number,
): BenchmarkContainer => createDependencyChain(depth, "singleton");

export const createDeepResolutionContainer = (
	depth: number,
): BenchmarkContainer => createDependencyChain(depth, "transient");

export const createScopeContainer = (
	registrationCount: number,
): BenchmarkContainer => {
	const builder = dynamicBuilder();
	for (let index = 0; index < registrationCount; index++) {
		const key = `service-${index}`;
		if (index % 3 === 0) {
			builder.registerSingletonFactory(key, () => staticValue);
		} else if (index % 3 === 1) {
			builder.registerScopedFactory(key, () => staticValue);
		} else {
			builder.registerTransientFactory(key, () => staticValue);
		}
	}
	return builder.build();
};

export const createMultiResolutionContainer = (
	registrationCount: number,
): BenchmarkContainer => {
	const builder = dynamicBuilder();
	for (let index = 0; index < registrationCount; index++) {
		builder.addSingletonFactory("items", () => ({ index }));
	}
	const container = builder.build();
	container.getAll("items");
	return container;
};

export const createDisposableContainer = (
	registrationCount: number,
	operation: "sync" | "async",
): BenchmarkContainer => {
	const builder = dynamicBuilder();
	for (let index = 0; index < registrationCount; index++) {
		builder.addSingletonFactory(
			"resources",
			operation === "sync"
				? () => ({
						[Symbol.dispose](): void {
							_disposalCount++;
						},
					})
				: () => ({
						async [Symbol.asyncDispose](): Promise<void> {
							_disposalCount++;
						},
					}),
		);
	}
	const container = builder.build();
	container.getAll("resources");
	return container;
};

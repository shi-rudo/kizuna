import { ContainerBuilder } from "../src/api/container-builder";

export interface BenchmarkCase {
	readonly size: number;
	readonly operationsPerSample: number;
}

const benchmarkCase = (
	size: number,
	operationsPerSample: number,
): BenchmarkCase => Object.freeze({ size, operationsPerSample });

export const benchmarkScenarios = Object.freeze({
	"container-build": Object.freeze([
		benchmarkCase(10, 200),
		benchmarkCase(100, 25),
		benchmarkCase(1_000, 5),
	]),
	"cold-resolve": Object.freeze([
		benchmarkCase(10, 500),
		benchmarkCase(100, 40),
		benchmarkCase(400, 8),
	]),
	"warm-resolve": Object.freeze([
		benchmarkCase(10, 25_000),
		benchmarkCase(100, 25_000),
		benchmarkCase(1_000, 25_000),
	]),
	"deep-resolve": Object.freeze([
		benchmarkCase(10, 2_500),
		benchmarkCase(100, 100),
		benchmarkCase(400, 10),
	]),
	"start-scope": Object.freeze([
		benchmarkCase(10, 1_000),
		benchmarkCase(100, 100),
		benchmarkCase(1_000, 10),
	]),
	"get-all": Object.freeze([
		benchmarkCase(10, 10_000),
		benchmarkCase(100, 1_500),
		benchmarkCase(1_000, 150),
	]),
	"sync-dispose": Object.freeze([
		benchmarkCase(10, 200),
		benchmarkCase(100, 40),
		benchmarkCase(1_000, 4),
	]),
	"async-dispose": Object.freeze([
		benchmarkCase(10, 200),
		benchmarkCase(100, 24),
		benchmarkCase(1_000, 2),
	]),
	"graph-singleton-roots": Object.freeze([
		benchmarkCase(500, 1),
		benchmarkCase(1_000, 1),
		benchmarkCase(2_000, 1),
		benchmarkCase(4_000, 1),
	]),
	"graph-independent-cycles": Object.freeze([
		benchmarkCase(500, 1),
		benchmarkCase(1_000, 1),
		benchmarkCase(2_000, 1),
		benchmarkCase(4_000, 1),
	]),
});

export type BenchmarkScenario = keyof typeof benchmarkScenarios;

export const preparedSampleCount = 50;

export const scenarioCases = <TScenario extends BenchmarkScenario>(
	scenario: TScenario,
): (typeof benchmarkScenarios)[TScenario] => benchmarkScenarios[scenario];

export const benchmarkName = (
	benchmarkCase: BenchmarkCase,
	unit: string,
): string =>
	`${benchmarkCase.size} ${unit} × ${benchmarkCase.operationsPerSample} operations/sample`;

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
	validate(): readonly unknown[];
}

const requiredBuilderMethods = [
	"registerSingletonFactory",
	"registerScopedFactory",
	"registerTransientFactory",
	"addSingletonFactory",
	"build",
	"validate",
] as const satisfies readonly (keyof ContainerBuilder)[];

/**
 * Create a builder for benchmark data that uses keys generated at run time.
 * The required public method names remain compile-time checked.
 */
export const createBenchmarkBuilder = (): BenchmarkBuilder => {
	const builder = new ContainerBuilder();
	for (const method of requiredBuilderMethods) {
		if (typeof builder[method] !== "function") {
			throw new TypeError(`ContainerBuilder.${method} must be a function`);
		}
	}
	return builder as unknown as BenchmarkBuilder;
};

const staticValue = Object.freeze({ value: 1 });
let _benchmarkSink: unknown;
let _disposalCount = 0;

export const consume = (value: unknown): void => {
	_benchmarkSink = value;
};

export const createSingletonBuilder = (
	registrationCount: number,
): BenchmarkBuilder => {
	const builder = createBenchmarkBuilder();
	for (let index = 0; index < registrationCount; index++) {
		builder.registerSingletonFactory(`service-${index}`, () => staticValue);
	}
	return builder;
};

export const createWarmResolutionContainer = (
	registrationCount: number,
): BenchmarkContainer => {
	const builder = createBenchmarkBuilder().registerSingletonFactory(
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
	const builder = createBenchmarkBuilder();
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
	const builder = createBenchmarkBuilder();
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
	const builder = createBenchmarkBuilder();
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
	const builder = createBenchmarkBuilder();
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

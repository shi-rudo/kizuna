import { expectTypeOf, test } from "vitest";
import { ContainerBuilder } from "../src";

interface Service {
	run(): void;
}

class ServiceImplementation implements Service {
	run(): void {}
}

interface LoggerContract {
	readonly kind: "logger";
}

class LoggerImplementation implements LoggerContract {
	readonly kind = "logger" as const;
}

class Config {
	readonly kind = "config" as const;
}

interface Consumer {
	run(): void;
}

class ConsumerImplementation implements Consumer {
	constructor(
		readonly logger: LoggerContract,
		readonly config: Config,
	) {}

	run(): void {}
}

test("interface registrations preserve literal keys", () => {
	// @ts-expect-error Explicit interface registration also requires its literal key.
	new ContainerBuilder().registerSingletonInterface<Service>(
		"singleton",
		ServiceImplementation,
	);
	// @ts-expect-error Explicit interface registration also requires its literal key.
	new ContainerBuilder().registerScopedInterface<Service>(
		"scoped",
		ServiceImplementation,
	);
	// @ts-expect-error Explicit interface registration also requires its literal key.
	new ContainerBuilder().registerTransientInterface<Service>(
		"transient",
		ServiceImplementation,
	);
	new ContainerBuilder().registerSingletonInterface<Service, string>(
		// @ts-expect-error A broad string type would allow unknown service keys.
		"singleton",
		ServiceImplementation,
	);
	new ContainerBuilder().registerScopedInterface<Service, string>(
		// @ts-expect-error A broad string type would allow unknown service keys.
		"scoped",
		ServiceImplementation,
	);
	new ContainerBuilder().registerTransientInterface<Service, string>(
		// @ts-expect-error A broad string type would allow unknown service keys.
		"transient",
		ServiceImplementation,
	);

	const provider = new ContainerBuilder()
		.registerSingletonInterface<Service, "singleton">(
			"singleton",
			ServiceImplementation,
		)
		.registerScopedInterface<Service, "scoped">("scoped", ServiceImplementation)
		.registerTransientInterface<Service, "transient">(
			"transient",
			ServiceImplementation,
		)
		.build();

	expectTypeOf(provider.get("singleton")).toEqualTypeOf<Service>();
	expectTypeOf(provider.get("scoped")).toEqualTypeOf<Service>();
	expectTypeOf(provider.get("transient")).toEqualTypeOf<Service>();

	// @ts-expect-error Unknown keys must not compile.
	provider.get("missing");

	const inferredProvider = new ContainerBuilder()
		.registerSingletonInterface("inferred", ServiceImplementation)
		.build();

	expectTypeOf(
		inferredProvider.get("inferred"),
	).toEqualTypeOf<ServiceImplementation>();
	// @ts-expect-error Inferred registries must also reject unknown keys.
	inferredProvider.get("missing");
});

test("interface registrations reject keys with multiple possible values", () => {
	type UnionKey = "registered" | "not-registered";
	type PatternKey = `service:${string}`;
	type NumericPatternKey = `service:${number}`;
	type BigintPatternKey = `service:${bigint}`;

	new ContainerBuilder().registerSingletonInterface<Service, UnionKey>(
		// @ts-expect-error A union would add keys that were not registered at runtime.
		"registered",
		ServiceImplementation,
	);
	new ContainerBuilder().registerScopedInterface<Service, UnionKey>(
		// @ts-expect-error A union would add keys that were not registered at runtime.
		"registered",
		ServiceImplementation,
	);
	new ContainerBuilder().registerTransientInterface<Service, UnionKey>(
		// @ts-expect-error A union would add keys that were not registered at runtime.
		"registered",
		ServiceImplementation,
	);
	new ContainerBuilder().registerSingletonInterface<Service, PatternKey>(
		// @ts-expect-error An open pattern would add keys that were not registered at runtime.
		"service:registered",
		ServiceImplementation,
	);
	new ContainerBuilder().registerScopedInterface<Service, PatternKey>(
		// @ts-expect-error An open pattern would add keys that were not registered at runtime.
		"service:registered",
		ServiceImplementation,
	);
	new ContainerBuilder().registerTransientInterface<Service, PatternKey>(
		// @ts-expect-error An open pattern would add keys that were not registered at runtime.
		"service:registered",
		ServiceImplementation,
	);
	new ContainerBuilder().registerSingletonInterface<Service, NumericPatternKey>(
		// @ts-expect-error An open numeric pattern would add keys that were not registered at runtime.
		"service:123",
		ServiceImplementation,
	);
	new ContainerBuilder().registerSingletonInterface<Service, BigintPatternKey>(
		// @ts-expect-error An open bigint pattern would add keys that were not registered at runtime.
		"service:123",
		ServiceImplementation,
	);

	const unionKey = null as unknown as UnionKey;
	new ContainerBuilder().registerSingletonInterface(
		// @ts-expect-error Inference must not turn one runtime key into a union registry.
		unionKey,
		ServiceImplementation,
	);

	const patternKey = null as unknown as PatternKey;
	new ContainerBuilder().registerSingletonInterface(
		// @ts-expect-error Inference must not turn one runtime key into a pattern registry.
		patternKey,
		ServiceImplementation,
	);

	const numericLiteralProvider = new ContainerBuilder()
		.registerSingletonInterface<Service, "service:123">(
			"service:123",
			ServiceImplementation,
		)
		.build();

	expectTypeOf(
		numericLiteralProvider.get("service:123"),
	).toEqualTypeOf<Service>();
});

test("interface dependency keys match implementation parameters", () => {
	const builder = new ContainerBuilder()
		.registerSingleton("logger", LoggerImplementation)
		.registerSingleton("config", Config);

	const provider = builder
		.registerSingletonInterface<
			Consumer,
			"singleton-consumer",
			typeof ConsumerImplementation
		>("singleton-consumer", ConsumerImplementation, "logger", "config")
		.registerScopedInterface<
			Consumer,
			"scoped-consumer",
			typeof ConsumerImplementation
		>("scoped-consumer", ConsumerImplementation, "logger", "config")
		.registerTransientInterface<
			Consumer,
			"transient-consumer",
			typeof ConsumerImplementation
		>("transient-consumer", ConsumerImplementation, "logger", "config")
		.build();

	expectTypeOf(provider.get("singleton-consumer")).toEqualTypeOf<Consumer>();
	expectTypeOf(provider.get("scoped-consumer")).toEqualTypeOf<Consumer>();
	expectTypeOf(provider.get("transient-consumer")).toEqualTypeOf<Consumer>();

	const inferredProvider = builder
		.registerSingletonInterface(
			"inferred-consumer",
			ConsumerImplementation,
			"logger",
			"config",
		)
		.build();
	expectTypeOf(
		inferredProvider.get("inferred-consumer"),
	).toEqualTypeOf<ConsumerImplementation>();

	// @ts-expect-error Dependency registrations require the implementation constructor type.
	builder.registerSingletonInterface<Consumer, "unsafe-two-generics">(
		"unsafe-two-generics",
		ConsumerImplementation,
		"logger",
		"config",
	);
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error A required singleton dependency cannot use the no-dependency overload.
	builder.registerSingletonInterface<Consumer, "singleton-no-dependencies">("singleton-no-dependencies", ConsumerImplementation);
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error A required scoped dependency cannot use the no-dependency overload.
	builder.registerScopedInterface<Consumer, "scoped-no-dependencies">("scoped-no-dependencies", ConsumerImplementation);
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error A required transient dependency cannot use the no-dependency overload.
	builder.registerTransientInterface<Consumer, "transient-no-dependencies">("transient-no-dependencies", ConsumerImplementation);

	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Singleton dependencies reject unknown keys.
	builder.registerSingletonInterface<Consumer, "singleton-unknown", typeof ConsumerImplementation>("singleton-unknown", ConsumerImplementation, "logger", "missing");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Singleton dependencies reject the wrong service type.
	builder.registerSingletonInterface<Consumer, "singleton-wrong", typeof ConsumerImplementation>("singleton-wrong", ConsumerImplementation, "logger", "logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Singleton dependencies follow the constructor parameter order.
	builder.registerSingletonInterface<Consumer, "singleton-order", typeof ConsumerImplementation>("singleton-order", ConsumerImplementation, "config", "logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Singleton dependencies include every required parameter.
	builder.registerSingletonInterface<Consumer, "singleton-missing", typeof ConsumerImplementation>("singleton-missing", ConsumerImplementation, "logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Singleton dependencies reject additional keys.
	builder.registerSingletonInterface<Consumer, "singleton-extra", typeof ConsumerImplementation>("singleton-extra", ConsumerImplementation, "logger", "config", "config");

	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Scoped dependencies reject unknown keys.
	builder.registerScopedInterface<Consumer, "scoped-unknown", typeof ConsumerImplementation>("scoped-unknown", ConsumerImplementation, "logger", "missing");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Scoped dependencies reject the wrong service type.
	builder.registerScopedInterface<Consumer, "scoped-wrong", typeof ConsumerImplementation>("scoped-wrong", ConsumerImplementation, "logger", "logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Scoped dependencies follow the constructor parameter order.
	builder.registerScopedInterface<Consumer, "scoped-order", typeof ConsumerImplementation>("scoped-order", ConsumerImplementation, "config", "logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Scoped dependencies include every required parameter.
	builder.registerScopedInterface<Consumer, "scoped-missing", typeof ConsumerImplementation>("scoped-missing", ConsumerImplementation, "logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Scoped dependencies reject additional keys.
	builder.registerScopedInterface<Consumer, "scoped-extra", typeof ConsumerImplementation>("scoped-extra", ConsumerImplementation, "logger", "config", "config");

	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Transient dependencies reject unknown keys.
	builder.registerTransientInterface<Consumer, "transient-unknown", typeof ConsumerImplementation>("transient-unknown", ConsumerImplementation, "logger", "missing");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Transient dependencies reject the wrong service type.
	builder.registerTransientInterface<Consumer, "transient-wrong", typeof ConsumerImplementation>("transient-wrong", ConsumerImplementation, "logger", "logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Transient dependencies follow the constructor parameter order.
	builder.registerTransientInterface<Consumer, "transient-order", typeof ConsumerImplementation>("transient-order", ConsumerImplementation, "config", "logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Transient dependencies include every required parameter.
	builder.registerTransientInterface<Consumer, "transient-missing", typeof ConsumerImplementation>("transient-missing", ConsumerImplementation, "logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Transient dependencies reject additional keys.
	builder.registerTransientInterface<Consumer, "transient-extra", typeof ConsumerImplementation>("transient-extra", ConsumerImplementation, "logger", "config", "config");
});

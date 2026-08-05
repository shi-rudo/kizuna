import { expectTypeOf, test } from "vitest";
import { ContainerBuilder } from "../src";

interface LoggerContract {
	readonly kind: "logger";
}

class Logger implements LoggerContract {
	readonly kind = "logger" as const;
}

class Config {
	readonly kind = "config" as const;
}

class Feature {
	readonly kind = "feature" as const;
}

class Consumer {
	constructor(
		readonly logger: LoggerContract,
		readonly config: Config,
	) {}
}

class OptionalConsumer {
	constructor(readonly logger?: LoggerContract) {}
}

class RestConsumer {
	constructor(...loggers: LoggerContract[]) {
		void loggers;
	}
}

class OverloadedConsumer {
	constructor(value: LoggerContract);
	constructor(value: Config);
	constructor(readonly value: LoggerContract | Config) {}
}

interface LoggerVariant {
	readonly source: "logger";
}

interface ConfigVariant {
	readonly source: "config";
}

interface VariantConstructor {
	new (value: LoggerContract): LoggerVariant;
	new (value: Config): ConfigVariant;
}

declare const VariantService: VariantConstructor;

test("the root builder registry cannot be forged", () => {
	// @ts-expect-error A root builder always starts with an empty runtime registry.
	new ContainerBuilder<{ logger: Logger }>();
});

test("constructor registrations require one fixed service key", () => {
	const broadKey = null as unknown as string;
	const unionKey = null as unknown as "first" | "second";
	const patternKey = null as unknown as `service:${string}`;

	// @ts-expect-error A broad key would make every string appear registered.
	new ContainerBuilder().registerSingleton(broadKey, Logger);
	// @ts-expect-error A union would add a key that was not registered at runtime.
	new ContainerBuilder().registerScoped(unionKey, Logger);
	// @ts-expect-error An open pattern would add keys that were not registered at runtime.
	new ContainerBuilder().registerTransient(patternKey, Logger);
	// @ts-expect-error Constructor-based multi-registrations also reject broad keys.
	new ContainerBuilder().addSingleton(broadKey, Logger);
	// @ts-expect-error Constructor-based multi-registrations also reject union keys.
	new ContainerBuilder().addScoped(unionKey, Logger);
	// @ts-expect-error Constructor-based multi-registrations also reject open patterns.
	new ContainerBuilder().addTransient(patternKey, Logger);

	new ContainerBuilder().registerSingleton("service:123", Logger);
});

test("constructor dependency keys match parameter types and positions", () => {
	const builder = new ContainerBuilder()
		.registerSingleton("logger", Logger)
		.registerSingleton("config", Config);

	const provider = builder
		.registerSingleton("singleton", Consumer, "logger", "config")
		.registerScoped("scoped", Consumer, "logger", "config")
		.registerTransient("transient", Consumer, "logger", "config")
		.build();

	expectTypeOf(provider.get("singleton")).toEqualTypeOf<Consumer>();
	expectTypeOf(provider.get("scoped")).toEqualTypeOf<Consumer>();
	expectTypeOf(provider.get("transient")).toEqualTypeOf<Consumer>();

	builder.registerSingleton<"explicit", typeof Consumer>(
		"explicit",
		Consumer,
		"logger",
		"config",
	);
	// @ts-expect-error The second generic argument is the constructor type, not its instance type.
	builder.registerSingleton<"old-explicit", Consumer>(
		"old-explicit",
		Consumer,
		"logger",
		"config",
	);

	// @ts-expect-error Unknown dependency keys must not compile.
	builder.registerSingleton("unknown", Consumer, "logger", "missing");
	// @ts-expect-error Dependency keys must follow the constructor parameter order.
	builder.registerSingleton("wrong-order", Consumer, "config", "logger");
	// @ts-expect-error Every required constructor parameter needs a dependency key.
	builder.registerSingleton("missing", Consumer, "logger");
	// @ts-expect-error Zero-argument constructors reject extra dependency keys.
	builder.registerSingleton("extra", Logger, "config");

	// @ts-expect-error Scoped registrations reject the wrong dependency type.
	builder.registerScoped("wrong-scoped", Consumer, "logger", "logger");
	// @ts-expect-error Transient registrations reject the wrong dependency type.
	builder.registerTransient("wrong-transient", Consumer, "config", "config");
});

test("constructor overloads accept every declared parameter tuple", () => {
	const builder = new ContainerBuilder()
		.registerSingleton("logger", Logger)
		.registerSingleton("config", Config)
		.registerSingleton("feature", Feature);

	const provider = builder
		.registerSingleton("logger-overload", OverloadedConsumer, "logger")
		.registerSingleton("config-overload", OverloadedConsumer, "config")
		.registerSingleton("variant", VariantService, "logger")
		.build();

	expectTypeOf(
		provider.get("logger-overload"),
	).toEqualTypeOf<OverloadedConsumer>();
	expectTypeOf(
		provider.get("config-overload"),
	).toEqualTypeOf<OverloadedConsumer>();
	expectTypeOf(provider.get("variant")).toEqualTypeOf<
		LoggerVariant | ConfigVariant
	>();

	// @ts-expect-error No constructor overload accepts Feature.
	builder.registerSingleton("invalid-overload", OverloadedConsumer, "feature");
});

test("optional and rest constructor parameters keep their tuple semantics", () => {
	const builder = new ContainerBuilder().registerSingleton("logger", Logger);

	builder.registerSingleton("optional-empty", OptionalConsumer);
	builder.registerSingleton("optional-value", OptionalConsumer, "logger");
	builder.registerSingleton("rest-empty", RestConsumer);
	builder.registerSingleton("rest-values", RestConsumer, "logger", "logger");

	// @ts-expect-error Optional parameters still reject incompatible services.
	builder.registerSingleton("optional-wrong", OptionalConsumer, "missing");
	// @ts-expect-error Every rest dependency must match the rest parameter type.
	builder.registerSingleton("rest-wrong", RestConsumer, "logger", "missing");
});

test("constructor-based multi-registrations use the same dependency checks", () => {
	const builder = new ContainerBuilder()
		.registerSingleton("logger", Logger)
		.registerSingleton("config", Config);

	builder.addSingleton("consumers", Consumer, "logger", "config");
	builder.addScoped("consumers", Consumer, "logger", "config");
	builder.addTransient("consumers", Consumer, "logger", "config");

	// @ts-expect-error Singleton multi-registrations reject the wrong order.
	builder.addSingleton("bad-singletons", Consumer, "config", "logger");
	// @ts-expect-error Scoped multi-registrations reject missing dependencies.
	builder.addScoped("bad-scoped", Consumer, "logger");
	// @ts-expect-error Transient multi-registrations reject unknown dependencies.
	builder.addTransient("bad-transients", Consumer, "logger", "missing");
});

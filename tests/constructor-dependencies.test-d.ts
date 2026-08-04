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

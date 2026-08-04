import { expectTypeOf, test } from "vitest";
import { ContainerBuilder } from "../src";

interface Service {
	run(): void;
}

class ServiceImplementation implements Service {
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

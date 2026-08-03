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

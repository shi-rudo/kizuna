import { expectTypeOf, test } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";
import { ServiceProvider } from "../src/api/service-provider";

class DiagnosticService {}

test("self-resolution is available without weakening the public types", () => {
	const provider = new ContainerBuilder()
		.registerSingleton("ServiceProvider", DiagnosticService)
		.build();

	expectTypeOf(
		provider.get("ServiceProvider"),
	).toEqualTypeOf<DiagnosticService>();

	const currentProvider = provider.get(ServiceProvider);
	expectTypeOf(currentProvider).not.toBeAny();
	expectTypeOf(currentProvider).toMatchTypeOf<{ startScope(): unknown }>();
});

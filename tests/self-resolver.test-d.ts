import { expectTypeOf, test } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";
import {
	ServiceProvider,
	ServiceProviderToken,
} from "../src/api/service-provider";

class DiagnosticService {}

class DerivedProvider<
	TRegistry extends Record<string, unknown>,
> extends ServiceProvider<TRegistry> {}

test("self-resolution is available without weakening the public types", () => {
	const provider = new ContainerBuilder()
		.registerSingleton("ServiceProvider", DiagnosticService)
		.build();

	expectTypeOf(
		provider.get("ServiceProvider"),
	).toEqualTypeOf<DiagnosticService>();

	const currentProvider = provider.get(ServiceProviderToken);
	expectTypeOf(currentProvider).not.toBeAny();
	expectTypeOf(currentProvider).toMatchTypeOf<{ startScope(): unknown }>();

	// @ts-expect-error Registered services must be resolved through their registry key.
	provider.get(DiagnosticService);

	// @ts-expect-error A provider subclass is not the explicit identity token.
	provider.get(DerivedProvider);
});

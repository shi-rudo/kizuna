import { expectTypeOf, test } from "vitest";
import type * as Kizuna from "../src";
import { Container, ServiceContainerToken } from "../src/api/container";
import { ContainerBuilder } from "../src/api/container-builder";

class DiagnosticService {}

class DerivedContainer<
	TRegistry extends Record<string, unknown>,
> extends Container<TRegistry> {}

test("self-resolution is available without weakening the public types", () => {
	const container = new ContainerBuilder()
		.registerSingleton("ServiceProvider", DiagnosticService)
		.build();

	expectTypeOf(
		container.get("ServiceProvider"),
	).toEqualTypeOf<DiagnosticService>();

	const currentContainer = container.get(ServiceContainerToken);
	expectTypeOf(currentContainer).not.toBeAny();
	expectTypeOf(currentContainer).toMatchTypeOf<{ startScope(): unknown }>();

	// @ts-expect-error Registered services must be resolved through their registry key.
	container.get(DiagnosticService);

	// @ts-expect-error A container subclass is not the explicit identity token.
	container.get(DerivedContainer);
});

test("the removed aliases are not part of the public API", () => {
	// @ts-expect-error TypeSafeServiceLocator was removed. Use ServiceContainer.
	type Locator = Kizuna.TypeSafeServiceLocator<{ answer: number }>;
	expectTypeOf<Locator>().not.toBeNever();

	// @ts-expect-error ServiceProviderToken was removed. Use ServiceContainerToken.
	type ProviderToken = typeof Kizuna.ServiceProviderToken;
	expectTypeOf<ProviderToken>().not.toBeNever();

	// @ts-expect-error count was removed. Use keyCount.
	void new ContainerBuilder().count;
});

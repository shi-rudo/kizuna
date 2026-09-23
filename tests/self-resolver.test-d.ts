import { expectTypeOf, test } from "vitest";
import type { ServiceContainer, TypeSafeServiceLocator } from "../src";
import {
	Container,
	ServiceContainerToken,
	ServiceProviderToken,
} from "../src/api/container";
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

test("deprecated names stay compatible with the new names", () => {
	expectTypeOf<TypeSafeServiceLocator<{ answer: number }>>().toEqualTypeOf<
		ServiceContainer<{ answer: number }>
	>();

	const container = new ContainerBuilder()
		.registerSingletonFactory("answer", () => 42)
		.build();

	expectTypeOf(container.get(ServiceProviderToken)).toEqualTypeOf<
		ServiceContainer<{ answer: number }>
	>();
});

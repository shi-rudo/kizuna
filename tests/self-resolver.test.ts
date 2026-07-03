import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";
import { ServiceProvider } from "../src/api/service-provider";

class Dummy {}

describe("ServiceProvider self-resolution", () => {
	it("resolves itself under the ServiceProvider key at the root", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		expect(container.get(ServiceProvider as never)).toBe(container);
	});

	it("resolves the scope provider (not the parent) inside a scope", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		const scope = container.startScope();
		expect(scope.get(ServiceProvider as never)).toBe(scope);
		expect(scope.get(ServiceProvider as never)).not.toBe(container);
	});

	it("keeps the parent usable after a scope holding a self-reference is disposed", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		const scope = container.startScope();
		scope.get(ServiceProvider as never);
		scope.dispose();

		expect(container.get("dummy")).toBeInstanceOf(Dummy);
		expect(container.get(ServiceProvider as never)).toBe(container);
	});

	it("dispose remains idempotent with the self-resolver present", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		container.get(ServiceProvider as never);
		expect(() => {
			container.dispose();
			container.dispose();
		}).not.toThrow();
	});
});

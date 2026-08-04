import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";
import { ServiceProviderToken } from "../src/api/service-provider";

class Dummy {}
class OtherDummy {}

describe("ServiceProvider self-resolution", () => {
	it("keeps the identity token separate from the same string key", () => {
		const container = new ContainerBuilder()
			.registerSingleton("ServiceProvider", Dummy)
			.build();

		expect(container.get("ServiceProvider")).toBeInstanceOf(Dummy);
		expect(container.get(ServiceProviderToken)).toBe(container);
	});

	it("keeps the string key available in child scopes", () => {
		const container = new ContainerBuilder()
			.registerScoped("ServiceProvider", Dummy)
			.build();
		const rootService = container.get("ServiceProvider");

		const scope = container.startScope();

		expect(scope.get("ServiceProvider")).toBeInstanceOf(Dummy);
		expect(scope.get("ServiceProvider")).not.toBe(rootService);
		expect(scope.get(ServiceProviderToken)).toBe(scope);
	});

	it("keeps multi-registrations separate from the identity token", () => {
		const container = new ContainerBuilder()
			.addSingleton("ServiceProvider", Dummy)
			.addSingleton("ServiceProvider", OtherDummy)
			.build();

		const services = container.getAll("ServiceProvider");

		expect(services).toHaveLength(2);
		expect(services[0]).toBeInstanceOf(Dummy);
		expect(services[1]).toBeInstanceOf(OtherDummy);
		expect(container.get(ServiceProviderToken)).toBe(container);
	});

	it("resolves itself under the ServiceProvider key at the root", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		expect(container.get(ServiceProviderToken)).toBe(container);
	});

	it("rejects class constructors at runtime", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();
		const untypedContainer = container as unknown as {
			get(token: unknown): unknown;
		};

		expect(() => untypedContainer.get(Dummy)).toThrow(
			"Service keys must be strings or ServiceProviderToken",
		);
	});

	it("resolves the scope provider (not the parent) inside a scope", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		const scope = container.startScope();
		expect(scope.get(ServiceProviderToken)).toBe(scope);
		expect(scope.get(ServiceProviderToken)).not.toBe(container);
	});

	it("keeps the parent usable after a scope holding a self-reference is disposed", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		const scope = container.startScope();
		scope.get(ServiceProviderToken);
		scope.dispose();

		expect(container.get("dummy")).toBeInstanceOf(Dummy);
		expect(container.get(ServiceProviderToken)).toBe(container);
	});

	it("dispose remains idempotent with the self-resolver present", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		container.get(ServiceProviderToken);
		expect(() => {
			container.dispose();
			container.dispose();
		}).not.toThrow();
	});
});

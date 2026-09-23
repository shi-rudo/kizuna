import { describe, expect, it } from "vitest";
import {
	ServiceContainerToken,
	ServiceProviderToken,
} from "../src/api/container";
import { ContainerBuilder } from "../src/api/container-builder";

class Dummy {}
class OtherDummy {}

describe("container self-resolution", () => {
	it("keeps the identity token separate from the same string key", () => {
		const container = new ContainerBuilder()
			.registerSingleton("ServiceProvider", Dummy)
			.build();

		expect(container.get("ServiceProvider")).toBeInstanceOf(Dummy);
		expect(container.get(ServiceContainerToken)).toBe(container);
	});

	it("keeps the string key available in child scopes", () => {
		const container = new ContainerBuilder()
			.registerScoped("ServiceProvider", Dummy)
			.build();
		const rootService = container.get("ServiceProvider");

		const scope = container.startScope();

		expect(scope.get("ServiceProvider")).toBeInstanceOf(Dummy);
		expect(scope.get("ServiceProvider")).not.toBe(rootService);
		expect(scope.get(ServiceContainerToken)).toBe(scope);
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
		expect(container.get(ServiceContainerToken)).toBe(container);
	});

	it("resolves itself through the identity token at the root", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		expect(container.get(ServiceContainerToken)).toBe(container);
	});

	it("rejects class constructors at runtime", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();
		const untypedContainer = container as unknown as {
			get(token: unknown): unknown;
		};

		expect(() => untypedContainer.get(Dummy)).toThrow(
			"Service keys must be strings or ServiceContainerToken",
		);
	});

	it("resolves the scope (not the parent) inside a scope", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		const scope = container.startScope();
		expect(scope.get(ServiceContainerToken)).toBe(scope);
		expect(scope.get(ServiceContainerToken)).not.toBe(container);
	});

	it("keeps the parent usable after a scope holding a self-reference is disposed", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		const scope = container.startScope();
		scope.get(ServiceContainerToken);
		scope.dispose();

		expect(container.get("dummy")).toBeInstanceOf(Dummy);
		expect(container.get(ServiceContainerToken)).toBe(container);
	});

	it("dispose remains idempotent with the self-resolver present", () => {
		const container = new ContainerBuilder()
			.registerSingleton("dummy", Dummy)
			.build();

		container.get(ServiceContainerToken);
		expect(() => {
			container.dispose();
			container.dispose();
		}).not.toThrow();
	});
});

describe("deprecated ServiceProviderToken", () => {
	it("holds the same symbol as ServiceContainerToken", () => {
		const container = new ContainerBuilder().build();

		expect(ServiceProviderToken).toBe(ServiceContainerToken);
		expect(container.get(ServiceProviderToken)).toBe(container);
	});
});

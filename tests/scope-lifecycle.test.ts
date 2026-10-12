import { describe, expect, it } from "vitest";
import { DisposalError } from "../src/api/container";
import { ContainerBuilder } from "../src/api/container-builder";

class RequestContext {}

const recordingResource = (events: string[], name: string) => ({
	dispose(): void {
		events.push(name);
	},
});

const recordingAsyncResource = (events: string[], name: string) => ({
	async [Symbol.asyncDispose](): Promise<void> {
		events.push(name);
	},
});

const failingAsyncResource = (name: string, delay: number) => ({
	async [Symbol.asyncDispose](): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, delay));
		throw new Error(name);
	},
});

describe("Scope independence", () => {
	it("resolves a scoped service for the first time after the root is disposed", () => {
		const container = new ContainerBuilder()
			.registerScoped("request", RequestContext)
			.build();
		const scope = container.startScope();
		container.dispose();

		expect(scope.get("request")).toBeInstanceOf(RequestContext);
	});

	it("resolves a scoped service for the first time after its parent scope is disposed", () => {
		const container = new ContainerBuilder()
			.registerScoped("request", RequestContext)
			.build();
		const parent = container.startScope();
		const child = parent.startScope();
		parent.dispose();

		expect(child.get("request")).toBeInstanceOf(RequestContext);
	});
});

describe("Scope disposal", () => {
	it("lets the root, not the scope, dispose a singleton that only a scope resolved", () => {
		const events: string[] = [];
		const container = new ContainerBuilder()
			.registerSingletonFactory("shared", () =>
				recordingResource(events, "shared"),
			)
			.build();
		const scope = container.startScope();
		scope.get("shared");

		scope.dispose();
		expect(events).toEqual([]);

		container.dispose();
		expect(events).toEqual(["shared"]);
	});

	it("keeps the declared order through a registration that the scope never created", () => {
		const events: string[] = [];
		const container = new ContainerBuilder()
			.registerScopedFactory("d", () => recordingResource(events, "d"))
			.registerScopedFactory("n", () => recordingResource(events, "n"), "d")
			.registerScopedFactory(
				"a",
				(current) => {
					current.get("d");
					return recordingResource(events, "a");
				},
				"n",
			)
			.build();
		const scope = container.startScope();
		scope.get("d");
		scope.get("a");

		scope.dispose();

		expect(events).toEqual(["a", "d"]);
	});

	it("keeps the declared order through a registration that the scope never created in disposeAsync()", async () => {
		const events: string[] = [];
		const container = new ContainerBuilder()
			.registerScopedFactory("d", () => recordingAsyncResource(events, "d"))
			.registerScopedFactory(
				"n",
				() => recordingAsyncResource(events, "n"),
				"d",
			)
			.registerScopedFactory(
				"a",
				(current) => {
					current.get("d");
					return recordingAsyncResource(events, "a");
				},
				"n",
			)
			.build();
		const scope = container.startScope();
		scope.get("d");
		scope.get("a");

		await scope.disposeAsync();

		expect(events).toEqual(["a", "d"]);
	});

	it("disposes independent services in registration order, not in resolution order", () => {
		const events: string[] = [];
		const container = new ContainerBuilder()
			.registerScopedFactory("first", () => recordingResource(events, "first"))
			.registerScopedFactory("second", () =>
				recordingResource(events, "second"),
			)
			.build();
		const scope = container.startScope();
		scope.get("second");
		scope.get("first");

		scope.dispose();

		expect(events).toEqual(["first", "second"]);
	});

	it("reports async cleanup failures in registration order, not in resolution or completion order", async () => {
		const container = new ContainerBuilder()
			.registerScopedFactory("first", () => failingAsyncResource("first", 10))
			.registerScopedFactory("second", () => failingAsyncResource("second", 0))
			.build();
		const scope = container.startScope();
		scope.get("second");
		scope.get("first");

		const error = await scope.disposeAsync().then(
			() => undefined,
			(caught: unknown) => caught,
		);

		expect(error).toBeInstanceOf(DisposalError);
		expect(
			(error as DisposalError).failures.map((failure) => failure.serviceKey),
		).toEqual(["first", "second"]);
	});
});

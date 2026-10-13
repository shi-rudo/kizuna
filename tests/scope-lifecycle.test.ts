import { describe, expect, it } from "vitest";
import { DisposalError } from "../src/api/container";
import { ContainerBuilder } from "../src/api/container-builder";
import {
	ContainerDisposedError,
	ServiceResolutionError,
} from "../src/core/errors";

class RequestContext {}

class RequestConsumer {
	constructor(readonly request: RequestContext) {}
}

const captureError = (action: () => unknown): unknown => {
	try {
		action();
	} catch (error) {
		return error;
	}
	return undefined;
};

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
	// ADR-006: the application disposes every scope before the root. A scope
	// that outlives its root cannot create services anymore.
	it("rejects the first resolution of a scoped service after the root is disposed", () => {
		const container = new ContainerBuilder()
			.registerScoped("request", RequestContext)
			.build();
		const scope = container.startScope();
		container.dispose();

		const error = captureError(() => scope.get("request"));

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(error).toMatchObject({ key: "request" });
		expect((error as ServiceResolutionError).cause).toBeInstanceOf(
			ContainerDisposedError,
		);
	});

	it("rejects the first resolution of a scoped service as soon as root disposeAsync() starts", async () => {
		const container = new ContainerBuilder()
			.registerScoped("request", RequestContext)
			.registerScoped("consumer", RequestConsumer, "request")
			.build();
		const scope = container.startScope();
		const disposal = container.disposeAsync();

		const error = captureError(() => scope.get("request"));
		await disposal;

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect((error as ServiceResolutionError).cause).toBeInstanceOf(
			ContainerDisposedError,
		);
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

	it("starts independent async cleanup in a scope without waiting for each other", async () => {
		const events: string[] = [];
		let finishSlow!: () => void;
		const slowGate = new Promise<void>((resolve) => {
			finishSlow = resolve;
		});
		const container = new ContainerBuilder()
			.registerScopedFactory("slow", () => ({
				async [Symbol.asyncDispose](): Promise<void> {
					events.push("slow started");
					await slowGate;
					events.push("slow finished");
				},
			}))
			.registerScopedFactory("fast", () =>
				recordingAsyncResource(events, "fast"),
			)
			.build();
		const scope = container.startScope();
		scope.get("slow");
		scope.get("fast");

		const disposal = scope.disposeAsync();
		await Promise.resolve();
		finishSlow();
		await disposal;

		expect(events).toEqual(["slow started", "fast", "slow finished"]);
	});

	it("keeps the declared order after the root is disposed", () => {
		const events: string[] = [];
		const container = new ContainerBuilder()
			.registerScopedFactory("d", () => recordingResource(events, "d"))
			.registerScopedFactory("a", () => recordingResource(events, "a"), "d")
			.build();
		const scope = container.startScope();
		scope.get("d");
		scope.get("a");
		container.dispose();

		scope.dispose();

		expect(events).toEqual(["a", "d"]);
	});

	it("keeps the declared order after the root is disposed in disposeAsync()", async () => {
		const events: string[] = [];
		const container = new ContainerBuilder()
			.registerScopedFactory("d", () => recordingAsyncResource(events, "d"))
			.registerScopedFactory(
				"a",
				() => recordingAsyncResource(events, "a"),
				"d",
			)
			.build();
		const scope = container.startScope();
		scope.get("d");
		scope.get("a");
		await container.disposeAsync();

		await scope.disposeAsync();

		expect(events).toEqual(["a", "d"]);
	});
});

import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src";

/** Records how many cleanups run at once. Each cleanup waits for one shared gate. */
const cleanupProbe = () => {
	let open: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => {
		open = resolve;
	});
	const events: string[] = [];
	let running = 0;
	let mostRunning = 0;
	const resource = (name: string) => ({
		async [Symbol.asyncDispose](): Promise<void> {
			events.push(`start:${name}`);
			running++;
			mostRunning = Math.max(mostRunning, running);
			await gate;
			running--;
			events.push(`end:${name}`);
		},
	});
	return {
		events,
		get started() {
			return events.filter((event) => event.startsWith("start:")).length;
		},
		get mostRunning() {
			return mostRunning;
		},
		open: () => open(),
		resource,
	};
};

const flushMicrotasks = async (): Promise<void> => {
	for (let round = 0; round < 20; round++) {
		await Promise.resolve();
	}
};

const independentResources = (
	count: number,
	probe: ReturnType<typeof cleanupProbe>,
) => {
	const builder = new ContainerBuilder();
	for (let index = 0; index < count; index++) {
		builder.addSingletonFactory("resources", () =>
			probe.resource(`resource-${index}`),
		);
	}
	return builder;
};

describe("async cleanup concurrency", () => {
	it("starts at most 16 cleanups at once by default", async () => {
		const probe = cleanupProbe();
		const container = independentResources(40, probe).build();
		container.getAll("resources");
		const disposal = container.disposeAsync();

		await flushMicrotasks();

		expect(probe.started).toBe(16);
		probe.open();
		await disposal;
	});

	it("runs every cleanup beyond the limit", async () => {
		const probe = cleanupProbe();
		const container = independentResources(40, probe).build();
		container.getAll("resources");
		const disposal = container.disposeAsync();
		await flushMicrotasks();

		probe.open();

		await disposal;
		expect(probe.started).toBe(40);
		expect(probe.mostRunning).toBe(16);
	});

	it("uses the maxAsyncDisposalConcurrency build option", async () => {
		const probe = cleanupProbe();
		const container = independentResources(10, probe).build({
			maxAsyncDisposalConcurrency: 3,
		});
		container.getAll("resources");
		const disposal = container.disposeAsync();

		await flushMicrotasks();

		expect(probe.started).toBe(3);
		probe.open();
		await disposal;
	});

	it("applies the limit of the root container in a scope", async () => {
		const probe = cleanupProbe();
		const builder = new ContainerBuilder();
		for (let index = 0; index < 10; index++) {
			builder.addScopedFactory("sessions", () =>
				probe.resource(`session-${index}`),
			);
		}
		const container = builder.build({ maxAsyncDisposalConcurrency: 2 });
		const scope = container.startScope();
		scope.getAll("sessions");
		const disposal = scope.disposeAsync();

		await flushMicrotasks();

		expect(probe.started).toBe(2);
		probe.open();
		await disposal;
	});

	it("starts a cleanup within the disposeAsync() call when a slot is free", async () => {
		let started = false;
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", () => ({
				async [Symbol.asyncDispose](): Promise<void> {
					started = true;
				},
			}))
			.build();
		container.get("resource");

		const disposal = container.disposeAsync();

		expect(started).toBe(true);
		await disposal;
	});

	it("starts waiting cleanups in the order in which they became ready", async () => {
		const probe = cleanupProbe();
		const container = independentResources(4, probe).build({
			maxAsyncDisposalConcurrency: 1,
		});
		container.getAll("resources");
		probe.open();

		await container.disposeAsync();

		expect(probe.events.filter((event) => event.startsWith("start:"))).toEqual(
			["resource-0", "resource-1", "resource-2", "resource-3"].map(
				(name) => `start:${name}`,
			),
		);
	});

	it("still disposes a consumer before its dependency at a limit of 1", async () => {
		const probe = cleanupProbe();
		const container = new ContainerBuilder()
			.registerSingletonFactory("pool", () => probe.resource("pool"))
			.registerSingletonFactory(
				"repository",
				(current) => {
					current.get("pool");
					return probe.resource("repository");
				},
				"pool",
			)
			.registerSingletonFactory("cache", () => probe.resource("cache"))
			.build({ maxAsyncDisposalConcurrency: 1 });
		container.get("repository");
		container.get("cache");
		probe.open();

		await container.disposeAsync();

		expect(probe.events.indexOf("end:repository")).toBeLessThan(
			probe.events.indexOf("start:pool"),
		);
		expect(probe.mostRunning).toBe(1);
	});
});

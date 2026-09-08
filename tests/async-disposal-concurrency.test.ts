import { describe, expect, it } from "vitest";
import { ContainerBuilder, DisposalError } from "../src";

interface Deferred {
	readonly promise: Promise<void>;
	resolve(): void;
}

const createDeferred = (): Deferred => {
	let resolve!: () => void;
	const promise = new Promise<void>((accept) => {
		resolve = accept;
	});
	return { promise, resolve };
};

const createStartTracker = () => {
	const started: number[] = [];
	const waiters: Array<{ count: number; resolve: () => void }> = [];
	return {
		started,
		mark(index: number): void {
			started.push(index);
			for (const waiter of waiters) {
				if (started.length >= waiter.count) {
					waiter.resolve();
				}
			}
		},
		waitFor(count: number): Promise<void> {
			if (started.length >= count) {
				return Promise.resolve();
			}
			return new Promise<void>((resolve) => {
				waiters.push({ count, resolve });
			});
		},
	};
};

const registerControlledServices = (
	count: number,
	releases: readonly Deferred[],
	onStart: (index: number) => void,
) => {
	const builder = new ContainerBuilder();
	for (let index = 0; index < count; index++) {
		builder.addSingletonFactory("services", () => ({
			async [Symbol.asyncDispose]() {
				onStart(index);
				await releases[index].promise;
			},
		}));
	}
	return builder;
};

describe("asynchronous disposal concurrency", () => {
	it("limits cleanup across independent services", async () => {
		const releases = Array.from({ length: 5 }, createDeferred);
		const starts = createStartTracker();
		let active = 0;
		let maxActive = 0;
		const builder = registerControlledServices(5, releases, (index) => {
			starts.mark(index);
			active++;
			maxActive = Math.max(maxActive, active);
			void releases[index].promise.then(() => {
				active--;
			});
		});
		const container = builder.build({
			maxAsyncDisposalConcurrency: 2,
		});
		container.getAll("services" as never);

		const disposal = container.disposeAsync();
		await starts.waitFor(2);
		expect(starts.started).toHaveLength(2);
		expect(maxActive).toBe(2);

		releases[0].resolve();
		releases[1].resolve();
		await starts.waitFor(4);
		expect(starts.started).toHaveLength(4);
		expect(maxActive).toBe(2);

		for (const release of releases) {
			release.resolve();
		}
		await disposal;
		expect(starts.started).toHaveLength(5);
		expect(maxActive).toBe(2);
	});

	it("uses a finite default cleanup limit", async () => {
		const serviceCount = 17;
		const releases = Array.from({ length: serviceCount }, createDeferred);
		const starts = createStartTracker();
		let active = 0;
		let maxActive = 0;
		const builder = registerControlledServices(
			serviceCount,
			releases,
			(index) => {
				starts.mark(index);
				active++;
				maxActive = Math.max(maxActive, active);
				void releases[index].promise.then(() => {
					active--;
				});
			},
		);
		const container = builder.build();
		container.getAll("services" as never);

		const disposal = container.disposeAsync();
		await starts.waitFor(16);
		expect(starts.started).toHaveLength(16);
		expect(maxActive).toBe(16);

		for (const release of releases) {
			release.resolve();
		}
		await disposal;
	});

	it("applies the configured limit to child scopes", async () => {
		const releases = Array.from({ length: 3 }, createDeferred);
		const starts = createStartTracker();
		let active = 0;
		let maxActive = 0;
		const builder = new ContainerBuilder();
		for (let index = 0; index < releases.length; index++) {
			builder.addScopedFactory("services", () => ({
				async [Symbol.asyncDispose]() {
					starts.mark(index);
					active++;
					maxActive = Math.max(maxActive, active);
					await releases[index].promise;
					active--;
				},
			}));
		}
		const container = builder.build({ maxAsyncDisposalConcurrency: 1 });
		const scope = container.startScope();
		scope.getAll("services" as never);

		const disposal = scope.disposeAsync();
		await starts.waitFor(1);
		expect(starts.started).toHaveLength(1);
		expect(maxActive).toBe(1);

		for (const [index, release] of releases.entries()) {
			release.resolve();
			if (index + 1 < releases.length) {
				await starts.waitFor(index + 2);
			}
		}
		await disposal;
		expect(maxActive).toBe(1);
		await container.disposeAsync();
	});

	it.each([
		0,
		-1,
		1.5,
		Number.POSITIVE_INFINITY,
		Number.NaN,
	])("rejects an invalid cleanup limit: %s", (maxAsyncDisposalConcurrency) => {
		expect(() =>
			new ContainerBuilder().build({ maxAsyncDisposalConcurrency }),
		).toThrow(RangeError);
	});

	it("continues bounded cleanup after hook rejections", async () => {
		const failures = [new Error("first failed"), new Error("third failed")];
		let active = 0;
		let maxActive = 0;
		const started: number[] = [];
		const builder = new ContainerBuilder();
		for (let index = 0; index < 4; index++) {
			builder.addSingletonFactory("services", () => ({
				async [Symbol.asyncDispose]() {
					active++;
					maxActive = Math.max(maxActive, active);
					started.push(index);
					await Promise.resolve();
					active--;
					if (index === 0) {
						throw failures[0];
					}
					if (index === 2) {
						throw failures[1];
					}
				},
			}));
		}
		const container = builder.build({ maxAsyncDisposalConcurrency: 1 });
		container.getAll("services" as never);

		await expect(container.disposeAsync()).rejects.toMatchObject({
			failures: [
				expect.objectContaining({
					registrationIndex: 0,
					error: failures[0],
				}),
				expect.objectContaining({
					registrationIndex: 2,
					error: failures[1],
				}),
			],
		});
		expect(started).toEqual([0, 1, 2, 3]);
		expect(maxActive).toBe(1);
	});
});

describe("concurrent disposeAsync() calls", () => {
	it("waits for the active successful disposal", async () => {
		const release = createDeferred();
		const started = createDeferred();
		let calls = 0;
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => ({
				async [Symbol.asyncDispose]() {
					calls++;
					started.resolve();
					await release.promise;
				},
			}))
			.build();
		container.get("service");

		const first = container.disposeAsync();
		let secondSettled = false;
		const secondCall = container.disposeAsync();
		expect(secondCall).toBe(first);
		const second = secondCall.then(() => {
			secondSettled = true;
		});
		await started.promise;
		await Promise.resolve();

		expect(calls).toBe(1);
		expect(secondSettled).toBe(false);
		release.resolve();
		await Promise.all([first, second]);
		expect(secondSettled).toBe(true);
	});

	it("shares a cleanup failure while later calls remain no-ops", async () => {
		const release = createDeferred();
		const cleanupFailure = new Error("cleanup failed");
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => ({
				async [Symbol.asyncDispose]() {
					await release.promise;
					throw cleanupFailure;
				},
			}))
			.build();
		container.get("service");

		const first = container.disposeAsync();
		const second = container.disposeAsync();
		expect(second).toBe(first);
		release.resolve();
		const results = await Promise.allSettled([first, second]);

		expect(results).toEqual([
			expect.objectContaining({
				status: "rejected",
				reason: expect.any(DisposalError),
			}),
			expect.objectContaining({
				status: "rejected",
				reason: expect.any(DisposalError),
			}),
		]);
		if (results[0].status === "rejected" && results[1].status === "rejected") {
			expect(results[1].reason).toBe(results[0].reason);
		}
		await expect(container.disposeAsync()).resolves.toBeUndefined();
	});
});

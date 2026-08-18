import { describe, expect, it } from "vitest";
import { ContainerBuilder, DisposalError } from "../src";

describe("async factory value disposal", () => {
	it("returns the original singleton Promise and disposes its resolved value once", async () => {
		let disposeCalls = 0;
		const service = {
			async [Symbol.asyncDispose](): Promise<void> {
				disposeCalls++;
			},
		};
		const servicePromise = Promise.resolve(service);
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => servicePromise)
			.build();

		expect(container.get("service")).toBe(servicePromise);
		expect(container.get("service")).toBe(servicePromise);

		await container.disposeAsync();
		await container.disposeAsync();

		expect(disposeCalls).toBe(1);
	});

	it("waits for a pending scoped factory Promise before it disposes the value", async () => {
		let disposeCalls = 0;
		const factoryResult = createDeferred<{
			[Symbol.dispose](): void;
		}>();
		const container = new ContainerBuilder()
			.registerScopedFactory("service", () => factoryResult.promise)
			.build();
		const scope = container.startScope();

		expect(scope.get("service")).toBe(factoryResult.promise);

		let disposalFinished = false;
		const disposal = scope.disposeAsync().then(() => {
			disposalFinished = true;
		});
		await nextTurn();

		expect(disposalFinished).toBe(false);
		expect(disposeCalls).toBe(0);

		factoryResult.resolve({
			[Symbol.dispose](): void {
				disposeCalls++;
			},
		});
		await disposal;
		await scope.disposeAsync();

		expect(disposalFinished).toBe(true);
		expect(disposeCalls).toBe(1);
	});

	it("reports a rejected factory Promise as an async cleanup failure", async () => {
		const failure = new Error("factory failed");
		const factoryResult = createDeferred<{ dispose(): void }>();
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => factoryResult.promise)
			.build();

		container.get("service");
		const disposal = container.disposeAsync();
		factoryResult.reject(failure);

		await expect(disposal).rejects.toMatchObject({
			name: "DisposalError",
			errors: [failure],
		});
	});

	it("starts resolved value cleanup and reports it on the synchronous path", async () => {
		let disposeCalls = 0;
		const servicePromise = Promise.resolve({
			async [Symbol.asyncDispose](): Promise<void> {
				disposeCalls++;
			},
		});
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => servicePromise)
			.build();

		container.get("service");

		let error: unknown;
		try {
			container.dispose();
		} catch (cause) {
			error = cause;
		}

		expect(error).toBeInstanceOf(DisposalError);
		expect(error).toMatchObject({
			errors: [
				expect.objectContaining({
					message: expect.stringContaining("Use disposeAsync()"),
				}),
			],
		});

		await nextTurn();
		expect(disposeCalls).toBe(1);
	});

	it("keeps synchronous hook priority for a resolved Promise value", async () => {
		const disposeCalls: string[] = [];
		const servicePromise = Promise.resolve({
			[Symbol.dispose](): void {
				disposeCalls.push("sync");
			},
			async [Symbol.asyncDispose](): Promise<void> {
				disposeCalls.push("async");
			},
		});
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => servicePromise)
			.build();

		container.get("service");

		expect(() => container.dispose()).toThrow(DisposalError);
		await nextTurn();

		expect(disposeCalls).toEqual(["sync"]);
	});

	it("handles a rejection after synchronous disposal starts", async () => {
		const factoryResult = createDeferred<{ dispose(): void }>();
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => factoryResult.promise)
			.build();

		container.get("service");

		expect(() => container.dispose()).toThrow(DisposalError);
		factoryResult.reject(new Error("factory failed after disposal"));

		await nextTurn();
	});

	it("ignores a resolved value without cleanup hooks", async () => {
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => Promise.resolve(42))
			.build();

		await container.get("service");

		await expect(container.disposeAsync()).resolves.toBeUndefined();
	});
});

function createDeferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: unknown) => void;
} {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((complete, fail) => {
		resolve = complete;
		reject = fail;
	});
	return { promise, resolve, reject };
}

function nextTurn(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

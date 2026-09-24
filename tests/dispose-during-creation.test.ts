import { describe, expect, it, vi } from "vitest";
import {
	ContainerBuilder,
	ContainerDisposedError,
	DisposalError,
	ServiceResolutionError,
} from "../src";

class Logger {}

class Consumer {
	constructor(readonly logger: Logger) {}
}

const captureError = (action: () => unknown): unknown => {
	try {
		action();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
};

const settle = (promise: Promise<unknown> | undefined): Promise<unknown> =>
	Promise.resolve(promise).then(
		() => undefined,
		(error: unknown) => error,
	);

const settledWithin = (
	promise: Promise<unknown> | undefined,
	milliseconds: number,
): Promise<"settled" | "pending"> =>
	Promise.race([
		Promise.resolve(promise).then(
			() => "settled" as const,
			() => "settled" as const,
		),
		new Promise<"pending">((resolve) =>
			setTimeout(() => resolve("pending"), milliseconds),
		),
	]);

const flushMicrotasks = async (): Promise<void> => {
	for (let round = 0; round < 5; round++) {
		await Promise.resolve();
	}
};

describe("a factory that calls dispose() on its own container", () => {
	it("cleans up the new singleton value and throws ContainerDisposedError", () => {
		const cleanup = vi.fn();
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				current.dispose();
				return { dispose: cleanup };
			})
			.build();

		const error = captureError(() => container.get("resource"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("cleans up the new scoped value when the factory disposes its scope", () => {
		const cleanup = vi.fn();
		const container = new ContainerBuilder()
			.registerScopedFactory("resource", (current) => {
				current.dispose();
				return { dispose: cleanup };
			})
			.build();
		const scope = container.startScope();

		const error = captureError(() => scope.get("resource"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("keeps a failing cleanup as the cause", () => {
		const cleanupFailure = new Error("cleanup failed");
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				current.dispose();
				return {
					dispose() {
						throw cleanupFailure;
					},
				};
			})
			.build();

		const error = captureError(() => container.get("resource"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect((error as ContainerDisposedError).cause).toBe(cleanupFailure);
	});

	it("reports an asynchronous-only cleanup as a TypeError cause", () => {
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				current.dispose();
				return { async [Symbol.asyncDispose]() {} };
			})
			.build();

		const error = captureError(() => container.get("resource"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect((error as ContainerDisposedError).cause).toBeInstanceOf(TypeError);
	});

	it("reports a Promise value as a TypeError cause and still starts its cleanup", async () => {
		const cleanup = vi.fn();
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				current.dispose();
				return Promise.resolve({ dispose: cleanup });
			})
			.build();

		const error = captureError(() => container.get("resource"));
		await flushMicrotasks();

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect((error as ContainerDisposedError).cause).toBeInstanceOf(TypeError);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});
});

describe("a factory that calls disposeAsync() on its own container", () => {
	it("rejects the value of a service that other services depend on", async () => {
		const cleanup = vi.fn();
		let pending: Promise<void> | undefined;
		const container = new ContainerBuilder()
			.registerSingletonFactory("logger", (current) => {
				pending = current.disposeAsync();
				return Object.assign(new Logger(), { dispose: cleanup });
			})
			.registerSingleton("consumer", Consumer, "logger")
			.build();

		const error = captureError(() => container.get("logger"));
		await pending;

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("uses the asynchronous cleanup and disposeAsync() waits for it", async () => {
		const events: string[] = [];
		let pending: Promise<void> | undefined;
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				pending = current.disposeAsync();
				return {
					async [Symbol.asyncDispose]() {
						await Promise.resolve();
						events.push("async cleanup");
					},
					[Symbol.dispose]() {
						events.push("sync cleanup");
					},
				};
			})
			.build();

		captureError(() => container.get("resource"));
		await pending;

		expect(events).toEqual(["async cleanup"]);
	});

	it("reports a failing asynchronous cleanup in the DisposalError", async () => {
		const failure = new Error("flush failed");
		let pending: Promise<void> | undefined;
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				pending = current.disposeAsync();
				return {
					async [Symbol.asyncDispose]() {
						throw failure;
					},
				};
			})
			.build();

		captureError(() => container.get("resource"));
		const disposalError = await settle(pending);

		expect(disposalError).toBeInstanceOf(DisposalError);
		expect((disposalError as DisposalError).failures).toEqual([
			expect.objectContaining({
				serviceKey: "resource",
				lifetime: "singleton",
				operation: "disposeAsync",
				error: failure,
			}),
		]);
	});

	it("settles when an async factory awaits disposeAsync() of its own container", async () => {
		let pending: Promise<void> | undefined;
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", async (current) => {
				pending = current.disposeAsync();
				await pending;
				return {};
			})
			.build();

		const error = captureError(() => container.get("resource"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(await settledWithin(pending, 100)).toBe("settled");
	});

	it("does not wait for a Promise value and does not report its rejection", async () => {
		let pending: Promise<void> | undefined;
		const container = new ContainerBuilder()
			.registerSingletonFactory("connection", (current) => {
				pending = current.disposeAsync();
				return Promise.reject(new Error("connect failed"));
			})
			.build();

		captureError(() => container.get("connection"));

		expect(await settle(pending)).toBeUndefined();
	});

	it("does not report a factory Promise that rejected before its cleanup started", async () => {
		let rejectConnection: ((error: Error) => void) | undefined;
		class Repository {
			constructor(readonly connection: Promise<unknown>) {}
			async [Symbol.asyncDispose](): Promise<void> {
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		}
		const container = new ContainerBuilder()
			.registerSingletonFactory(
				"connection",
				() =>
					new Promise<unknown>((_, reject) => {
						rejectConnection = reject;
					}),
			)
			.registerSingleton("repository", Repository, "connection")
			.build();
		container.get("connection").catch(() => undefined);
		container.get("repository");

		const pending = container.disposeAsync();
		rejectConnection?.(new Error("connect failed"));

		expect(await settle(pending)).toBeUndefined();
	});
});

describe("a factory that uses a disposed container", () => {
	it("reports ContainerDisposedError when an earlier multi-registration entry disposed the container", () => {
		const container = new ContainerBuilder()
			.addTransientFactory("handlers", (current) => {
				current.dispose();
				return {};
			})
			.addSingletonFactory("handlers", () => ({}))
			.build();

		const error = captureError(() => container.getAll("handlers"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
	});

	it("wraps a ContainerDisposedError from another container with the requested key", () => {
		const other = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.build();
		other.dispose();
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => other.get("logger"))
			.build();

		const error = captureError(() => container.get("service"));

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(error).toMatchObject({ key: "service" });
		expect((error as ServiceResolutionError).cause).toBeInstanceOf(
			ContainerDisposedError,
		);
	});

	it("returns the value of a transient factory that disposes its container", () => {
		const container = new ContainerBuilder()
			.registerTransientFactory("value", (current) => {
				current.dispose();
				return { id: 1 };
			})
			.build();

		expect(container.get("value")).toEqual({ id: 1 });
	});
});

describe("a closed container", () => {
	it("rejects a root singleton in a live scope once root disposal starts", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.registerSingleton("consumer", Consumer, "logger")
			.build();
		const scope = container.startScope();
		scope.get("logger");

		const pending = container.disposeAsync();
		const error = captureError(() => scope.get("logger"));
		await pending;

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect((error as ServiceResolutionError).cause).toBeInstanceOf(
			ContainerDisposedError,
		);
	});

	it("rejects a borrowed singleton in a live scope once the borrower starts disposeAsync()", async () => {
		const source = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.build();
		const borrower = new ContainerBuilder()
			.borrowSingletonFrom(source, "logger")
			.registerSingleton("consumer", Consumer, "logger")
			.build();
		const scope = borrower.startScope();
		scope.get("logger");

		const pending = borrower.disposeAsync();
		const error = captureError(() => scope.get("logger"));
		await pending;

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect((error as ServiceResolutionError).cause).toBeInstanceOf(
			ContainerDisposedError,
		);
	});
});

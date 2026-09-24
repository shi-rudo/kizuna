import { afterEach, describe, expect, it, vi } from "vitest";
import { ContainerBuilder, type DiagnosticEvent, DisposalError } from "../src";

const captureError = (action: () => unknown): unknown => {
	try {
		action();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
};

// Lets started cleanup Promises settle.
const settle = (): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, 0));

const failingAsyncCleanup = (failure: Error) => ({
	async [Symbol.asyncDispose](): Promise<void> {
		throw failure;
	},
});

const recorder = () => {
	const events: DiagnosticEvent[] = [];
	return { events, listener: (event: DiagnosticEvent) => events.push(event) };
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("UNAWAITED_CLEANUP_FAILED", () => {
	it("reports a failing cleanup of a Promise value that disposeAsync() does not wait for", async () => {
		const failure = new Error("close failed");
		const { events, listener } = recorder();
		let pending: Promise<void> | undefined;
		const container = new ContainerBuilder()
			.registerSingletonFactory("connection", (current) => {
				pending = current.disposeAsync();
				return Promise.resolve(failingAsyncCleanup(failure));
			})
			.build({ diagnostics: { listener } });
		captureError(() => container.get("connection"));
		await pending;

		await settle();

		expect(events).toEqual([
			expect.objectContaining({
				code: "UNAWAITED_CLEANUP_FAILED",
				level: "error",
				serviceKey: "connection",
				lifetime: "singleton",
				operation: "disposeAsync",
				error: failure,
			}),
		]);
	});

	it("reports a later rejection of async cleanup that dispose() cannot wait for", async () => {
		const failure = new Error("flush failed");
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerSingletonFactory("queue", () => failingAsyncCleanup(failure))
			.build({ diagnostics: { listener } });
		container.get("queue");
		captureError(() => container.dispose());

		await settle();

		expect(events).toEqual([
			expect.objectContaining({
				code: "UNAWAITED_CLEANUP_FAILED",
				serviceKey: "queue",
				lifetime: "singleton",
				operation: "dispose",
				error: failure,
			}),
		]);
	});

	it("reports a failure in a scope through the listener of the root container", async () => {
		const failure = new Error("session close failed");
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerScopedFactory("session", () => failingAsyncCleanup(failure))
			.build({ diagnostics: { listener } });
		const scope = container.startScope();
		scope.get("session");
		captureError(() => scope.dispose());

		await settle();

		expect(events).toEqual([
			expect.objectContaining({
				code: "UNAWAITED_CLEANUP_FAILED",
				serviceKey: "session",
				lifetime: "scoped",
			}),
		]);
	});

	it("does not report a cleanup failure that disposeAsync() already reports", async () => {
		const failure = new Error("close failed");
		const { events, listener } = recorder();
		let pending: Promise<void> | undefined;
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				pending = current.disposeAsync();
				return failingAsyncCleanup(failure);
			})
			.build({ diagnostics: { listener } });
		captureError(() => container.get("resource"));
		await pending?.catch(() => undefined);

		await settle();

		expect(events).toEqual([]);
	});

	it("rethrows a listener error in a microtask and keeps the disposal result", async () => {
		const listenerFailure = new Error("listener failed");
		const scheduled: (() => void)[] = [];
		vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
			scheduled.push(callback);
		});
		const container = new ContainerBuilder()
			.registerSingletonFactory("queue", () =>
				failingAsyncCleanup(new Error("flush failed")),
			)
			.build({
				diagnostics: {
					listener: () => {
						throw listenerFailure;
					},
				},
			});
		container.get("queue");
		const disposalError = captureError(() => container.dispose());

		await settle();

		expect(disposalError).toBeInstanceOf(DisposalError);
		expect(scheduled).toHaveLength(1);
		expect(() => scheduled[0]?.()).toThrow(listenerFailure);
	});
});

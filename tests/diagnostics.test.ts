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

const eventsWithCode = (
	events: readonly DiagnosticEvent[],
	code: DiagnosticEvent["code"],
): DiagnosticEvent[] => events.filter((event) => event.code === code);

class Logger {}

class Consumer {
	constructor(readonly logger: Logger) {}
}

class Handler {}

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

	it("does not report the rejection of a pending factory Promise as a cleanup failure", async () => {
		const { events, listener } = recorder();
		let rejectConnection: ((error: Error) => void) | undefined;
		const container = new ContainerBuilder()
			.registerSingletonFactory(
				"connection",
				() =>
					new Promise<object>((_, reject) => {
						rejectConnection = reject;
					}),
			)
			.build({ diagnostics: { listener } });
		container.get("connection").catch(() => undefined);
		captureError(() => container.dispose());

		rejectConnection?.(new Error("connect failed"));
		await settle();

		expect(events).toEqual([]);
	});

	it("does not report the rejection of a Promise value that disposeAsync() discarded", async () => {
		const { events, listener } = recorder();
		let pending: Promise<void> | undefined;
		const container = new ContainerBuilder()
			.registerSingletonFactory("connection", (current) => {
				pending = current.disposeAsync();
				return Promise.reject(new Error("connect failed"));
			})
			.build({ diagnostics: { listener } });
		captureError(() => container.get("connection"));
		await pending;

		await settle();

		expect(events).toEqual([]);
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

describe("diagnostic levels", () => {
	it("delivers no debug events at the default level", () => {
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.build({ diagnostics: { listener } });
		container.get("logger");
		container.startScope().dispose();

		container.dispose();

		expect(events).toEqual([]);
	});
});

describe("debug events", () => {
	it("reports CONTAINER_BUILT with the registration counts and the validation mode", () => {
		const { events, listener } = recorder();

		new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.addSingleton("handlers", Handler)
			.addSingleton("handlers", Handler)
			.build({
				validation: "deferred",
				diagnostics: { listener, level: "debug" },
			});

		expect(events).toEqual([
			expect.objectContaining({
				code: "CONTAINER_BUILT",
				level: "debug",
				keyCount: 2,
				registrationCount: 3,
				validation: "deferred",
			}),
		]);
	});

	it("reports SCOPE_STARTED for each scope", () => {
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerScoped("logger", Logger)
			.build({ diagnostics: { listener, level: "debug" } });
		container.startScope();

		container.startScope();

		expect(eventsWithCode(events, "SCOPE_STARTED")).toHaveLength(2);
	});

	it("reports CONTAINER_DISPOSED for a scope and the root with the disposal mode", async () => {
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerScoped("logger", Logger)
			.build({ diagnostics: { listener, level: "debug" } });
		container.startScope().dispose();

		await container.disposeAsync();

		expect(eventsWithCode(events, "CONTAINER_DISPOSED")).toEqual([
			expect.objectContaining({
				container: "scope",
				mode: "sync",
				failureCount: 0,
			}),
			expect.objectContaining({
				container: "root",
				mode: "async",
				failureCount: 0,
			}),
		]);
	});

	it("reports CONTAINER_DISPOSED with the failure count when disposal fails", () => {
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", () => ({
				dispose() {
					throw new Error("close failed");
				},
			}))
			.build({ diagnostics: { listener, level: "debug" } });
		container.get("resource");

		captureError(() => container.dispose());

		expect(eventsWithCode(events, "CONTAINER_DISPOSED")).toEqual([
			expect.objectContaining({ container: "root", failureCount: 1 }),
		]);
	});

	it("reports SERVICE_CREATED once for a singleton and nothing for a cache hit", () => {
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.build({ diagnostics: { listener, level: "debug" } });
		container.get("logger");

		container.get("logger");

		expect(eventsWithCode(events, "SERVICE_CREATED")).toEqual([
			expect.objectContaining({
				serviceKey: "logger",
				lifetime: "singleton",
				container: "root",
				path: ["logger"],
			}),
		]);
	});

	it("reports SERVICE_CREATED for each transient value", () => {
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerTransient("handler", Handler)
			.build({ diagnostics: { listener, level: "debug" } });
		container.get("handler");

		container.get("handler");

		expect(eventsWithCode(events, "SERVICE_CREATED")).toHaveLength(2);
	});

	it("reports the resolution path of a created dependency", () => {
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.registerSingleton("consumer", Consumer, "logger")
			.build({ diagnostics: { listener, level: "debug" } });

		container.get("consumer");

		expect(eventsWithCode(events, "SERVICE_CREATED")).toEqual([
			expect.objectContaining({
				serviceKey: "logger",
				path: ["consumer", "logger"],
			}),
			expect.objectContaining({ serviceKey: "consumer", path: ["consumer"] }),
		]);
	});

	it("reports SERVICE_CREATED in the scope that resolved the value", () => {
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerScoped("logger", Logger)
			.build({ diagnostics: { listener, level: "debug" } });

		container.startScope().get("logger");

		expect(eventsWithCode(events, "SERVICE_CREATED")).toEqual([
			expect.objectContaining({ serviceKey: "logger", container: "scope" }),
		]);
	});

	it("does not report SERVICE_CREATED when the factory throws", () => {
		const { events, listener } = recorder();
		const container = new ContainerBuilder()
			.registerSingletonFactory("broken", (): Logger => {
				throw new Error("factory failed");
			})
			.build({ diagnostics: { listener, level: "debug" } });

		captureError(() => container.get("broken"));

		expect(eventsWithCode(events, "SERVICE_CREATED")).toEqual([]);
	});

	it("reports one creation when a dependency creates the same singleton through another container", () => {
		const { events, listener } = recorder();
		let nested = false;
		const root = new ContainerBuilder()
			.registerTransientFactory("connection", () => {
				if (!nested) {
					nested = true;
					root.get("repository");
				}
				return new Logger();
			})
			.registerSingleton("repository", Consumer, "connection")
			.build({ diagnostics: { listener, level: "debug" } });
		const scope = root.startScope();

		scope.get("repository");

		const repositoryCreations = eventsWithCode(
			events,
			"SERVICE_CREATED",
		).filter(
			(event) => "serviceKey" in event && event.serviceKey === "repository",
		);
		expect(repositoryCreations).toHaveLength(1);
	});
});

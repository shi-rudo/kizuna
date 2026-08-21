import { describe, expect, it } from "vitest";
import { ContainerBuilder, interfaceToken } from "../src";

describe("borrowSingletonFrom()", () => {
	it("resolves the singleton from the source container", () => {
		class Logger {}

		const source = new ContainerBuilder()
			.registerSingleton("Logger", Logger)
			.build();
		const borrower = new ContainerBuilder()
			.borrowSingletonFrom(source, "Logger")
			.build();

		expect(borrower.get("Logger")).toBe(source.get("Logger"));
	});

	it("rejects a scoped source registration", () => {
		class RequestContext {}

		const source = new ContainerBuilder()
			.registerScoped("RequestContext", RequestContext)
			.build();

		expect(() =>
			new ContainerBuilder().borrowSingletonFrom(source, "RequestContext"),
		).toThrow(
			"Cannot borrow service 'RequestContext'. The source registration is scoped. Only singleton registrations can be borrowed.",
		);
	});

	it("rejects a transient source registration", () => {
		class RequestId {}

		const source = new ContainerBuilder()
			.registerTransient("RequestId", RequestId)
			.build();

		expect(() =>
			new ContainerBuilder().borrowSingletonFrom(source, "RequestId"),
		).toThrow(
			"Cannot borrow service 'RequestId'. The source registration is transient. Only singleton registrations can be borrowed.",
		);
	});

	it("rejects a multi-service source registration", () => {
		class FirstPlugin {}
		class SecondPlugin {}

		const source = new ContainerBuilder()
			.addSingleton("plugins", FirstPlugin)
			.addSingleton("plugins", SecondPlugin)
			.build();

		expect(() =>
			new ContainerBuilder().borrowSingletonFrom(source, "plugins"),
		).toThrow(
			"Cannot borrow service 'plugins'. Multi-service registrations are not supported.",
		);
	});

	it("rejects a service locator that is not a Kizuna container", () => {
		expect(() =>
			new ContainerBuilder().borrowSingletonFrom(
				{} as never,
				"Logger" as never,
			),
		).toThrow("The source must be a Kizuna service container");
	});

	it("rejects a source that was already disposed", () => {
		class Logger {}

		const source = new ContainerBuilder()
			.registerSingleton("Logger", Logger)
			.build();
		source.dispose();

		expect(() =>
			new ContainerBuilder().borrowSingletonFrom(source, "Logger"),
		).toThrow("Cannot access services from a disposed container");
	});

	it("supports interface tokens", () => {
		interface Clock {
			now(): number;
		}

		class SystemClock implements Clock {
			now(): number {
				return Date.now();
			}
		}

		const Clock = interfaceToken<Clock>()("Clock");
		const source = new ContainerBuilder()
			.registerSingletonInterface(Clock, SystemClock)
			.build();
		const borrower = new ContainerBuilder()
			.borrowSingletonFrom(source, Clock)
			.build();

		expect(borrower.get(Clock)).toBe(source.get(Clock));
	});

	it("does not dispose a borrowed value on the synchronous path", () => {
		let disposeCalls = 0;

		class SharedService {
			dispose(): void {
				disposeCalls++;
			}
		}

		const source = new ContainerBuilder()
			.registerSingleton("SharedService", SharedService)
			.build();
		const borrower = new ContainerBuilder()
			.borrowSingletonFrom(source, "SharedService")
			.build();

		borrower.get("SharedService");
		borrower.dispose();
		expect(disposeCalls).toBe(0);

		source.dispose();
		expect(disposeCalls).toBe(1);
	});

	it("does not dispose a borrowed value on the asynchronous path", async () => {
		let disposeCalls = 0;

		class SharedService {
			async [Symbol.asyncDispose](): Promise<void> {
				disposeCalls++;
			}
		}

		const source = new ContainerBuilder()
			.registerSingleton("SharedService", SharedService)
			.build();
		const borrower = new ContainerBuilder()
			.borrowSingletonFrom(source, "SharedService")
			.build();

		borrower.get("SharedService");
		await borrower.disposeAsync();
		expect(disposeCalls).toBe(0);

		await source.disposeAsync();
		expect(disposeCalls).toBe(1);
	});

	it("shares the borrowed value with borrower scopes", () => {
		class SharedService {}

		const source = new ContainerBuilder()
			.registerSingleton("SharedService", SharedService)
			.build();
		const borrower = new ContainerBuilder()
			.borrowSingletonFrom(source, "SharedService")
			.build();
		const firstScope = borrower.startScope();
		const secondScope = borrower.startScope();

		expect(firstScope.get("SharedService")).toBe(source.get("SharedService"));
		expect(secondScope.get("SharedService")).toBe(source.get("SharedService"));

		firstScope.dispose();
		expect(secondScope.get("SharedService")).toBe(source.get("SharedService"));
	});

	it("fails when the source container was disposed", () => {
		class SharedService {}

		const source = new ContainerBuilder()
			.registerSingleton("SharedService", SharedService)
			.build();
		const borrower = new ContainerBuilder()
			.borrowSingletonFrom(source, "SharedService")
			.build();

		source.dispose();

		expect(() => borrower.get("SharedService")).toThrow(
			"Cannot access services from a disposed container",
		);
	});

	it("keeps local dependency order on the synchronous path", () => {
		const events: string[] = [];

		class SharedService {
			dispose(): void {
				events.push("shared");
			}
		}

		class Repository {
			dispose(): void {
				events.push("repository");
			}
		}

		class Service {
			constructor(
				readonly repository: Repository,
				readonly shared: SharedService,
			) {}

			dispose(): void {
				events.push("service");
			}
		}

		const source = new ContainerBuilder()
			.registerSingleton("shared", SharedService)
			.build();
		const borrowerBuilder = new ContainerBuilder()
			.borrowSingletonFrom(source, "shared")
			.registerScoped("repository", Repository)
			.registerScoped("service", Service, "repository", "shared");
		expect(borrowerBuilder.validate()).toEqual([]);
		const borrower = borrowerBuilder.build();

		borrower.get("service");
		borrower.dispose();
		expect(events).toEqual(["service", "repository"]);

		source.dispose();
		expect(events).toEqual(["service", "repository", "shared"]);
	});

	it("waits for local consumers before async dependency cleanup", async () => {
		const events: string[] = [];
		let finishService!: () => void;
		const serviceGate = new Promise<void>((resolve) => {
			finishService = resolve;
		});

		class SharedService {
			async dispose(): Promise<void> {
				events.push("shared");
			}
		}

		class Repository {
			async dispose(): Promise<void> {
				events.push("repository");
			}
		}

		class Service {
			constructor(
				readonly repository: Repository,
				readonly shared: SharedService,
			) {}

			async dispose(): Promise<void> {
				events.push("service:start");
				await serviceGate;
				events.push("service:end");
			}
		}

		const source = new ContainerBuilder()
			.registerSingleton("shared", SharedService)
			.build();
		const borrower = new ContainerBuilder()
			.borrowSingletonFrom(source, "shared")
			.registerScoped("repository", Repository)
			.registerScoped("service", Service, "repository", "shared")
			.build();

		borrower.get("service");
		const disposal = borrower.disposeAsync();
		await Promise.resolve();
		expect(events).toEqual(["service:start"]);

		finishService();
		await disposal;
		expect(events).toEqual(["service:start", "service:end", "repository"]);

		await source.disposeAsync();
		expect(events).toEqual([
			"service:start",
			"service:end",
			"repository",
			"shared",
		]);
	});
});

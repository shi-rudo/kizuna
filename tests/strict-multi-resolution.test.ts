import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";
import { interfaceToken } from "../src/api/interface-token";

interface Handler {
	handle(): string;
}

class HandlerA implements Handler {
	handle() {
		return "A";
	}
}

class HandlerB implements Handler {
	handle() {
		return "B";
	}
}

class Logger {}

class EventBus {
	constructor(readonly handlers: Handler[]) {}
}

const LoggerToken = interfaceToken<Logger>()("ILogger");

const createContainer = () =>
	new ContainerBuilder()
		.registerSingleton("logger", Logger)
		.registerSingletonInterface(LoggerToken, Logger)
		.addSingleton("handlers", HandlerA)
		.addSingleton("handlers", HandlerB)
		.build();

describe("strict single and multi resolution", () => {
	it("rejects get() for a key with multiple registrations", () => {
		const container = createContainer();
		const untyped = container as unknown as { get(key: string): unknown };

		expect(() => untyped.get("handlers")).toThrow(
			"Key 'handlers' has multiple registrations. Use getAll('handlers') to resolve them.",
		);
	});

	it("rejects getAll() for a key with one registration", () => {
		const container = createContainer();
		const untyped = container as unknown as { getAll(key: string): unknown };

		expect(() => untyped.getAll("logger")).toThrow(
			"Key 'logger' has a single registration. Use get('logger') to resolve it.",
		);
	});

	it("rejects getAll() for an interface token", () => {
		const container = createContainer();
		const untyped = container as unknown as { getAll(key: string): unknown };

		expect(() => untyped.getAll(LoggerToken)).toThrow(
			"Key 'ILogger' has a single registration. Use get('ILogger') to resolve it.",
		);
	});

	it("keeps getAll() for a key with multiple registrations", () => {
		const handlers = createContainer().getAll("handlers");

		expect(handlers.map((handler) => handler.handle())).toEqual(["A", "B"]);
	});

	it("injects all services of a multi-registration key into a constructor", () => {
		const container = new ContainerBuilder()
			.addSingleton("handlers", HandlerA)
			.addSingleton("handlers", HandlerB)
			.registerSingleton("bus", EventBus, "handlers")
			.build();

		const bus = container.get("bus");

		expect(bus.handlers.map((handler) => handler.handle())).toEqual(["A", "B"]);
		expect(bus.handlers).toEqual(container.getAll("handlers"));
	});

	it("injects scoped multi-registrations from the current scope", () => {
		const container = new ContainerBuilder()
			.addScoped("handlers", HandlerA)
			.registerScoped("bus", EventBus, "handlers")
			.build();
		const scope = container.startScope();

		const bus = scope.get("bus");

		expect(bus.handlers).toEqual(scope.getAll("handlers"));
		expect(bus.handlers[0]).not.toBe(container.getAll("handlers")[0]);
	});

	it("lets a factory resolve a multi-registration key through getAll()", () => {
		const container = new ContainerBuilder()
			.addSingleton("handlers", HandlerA)
			.addSingleton("handlers", HandlerB)
			.registerSingletonFactory(
				"summary",
				(current) =>
					current
						.getAll("handlers")
						.map((handler) => handler.handle())
						.join(""),
				"handlers",
			)
			.build();

		expect(container.get("summary")).toBe("AB");
	});
});

describe("builder counts", () => {
	it("counts keys and registrations separately", () => {
		const builder = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.addSingleton("handlers", HandlerA)
			.addSingleton("handlers", HandlerB);

		expect(builder.keyCount).toBe(2);
		expect(builder.registrationCount).toBe(3);
	});

	it("keeps the deprecated count as the key count", () => {
		const builder = new ContainerBuilder()
			.addSingleton("handlers", HandlerA)
			.addSingleton("handlers", HandlerB);

		expect(builder.count).toBe(builder.keyCount);
	});
});

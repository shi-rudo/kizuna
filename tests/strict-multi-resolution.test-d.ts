import { expectTypeOf, test } from "vitest";
import type { MultiRegistration, ServiceContainer } from "../src";
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

class Logger {
	log(): void {}
}

class EventBus {
	constructor(readonly handlers: Handler[]) {}
}

class LoggerOnly {
	constructor(readonly logger: Logger) {}
}

const LoggerToken = interfaceToken<Logger>()("ILogger");

const container = new ContainerBuilder()
	.registerSingleton("logger", Logger)
	.registerSingletonInterface(LoggerToken, Logger)
	.registerSingletonFactory("languages", () => ["en", "de"])
	.addSingleton("handlers", HandlerA)
	.addSingleton("handlers", HandlerB)
	.build();

test("get() accepts only keys with one registration", () => {
	expectTypeOf(container.get("logger")).toEqualTypeOf<Logger>();
	expectTypeOf(container.get(LoggerToken)).toEqualTypeOf<Logger>();
	expectTypeOf(container.get("languages")).toEqualTypeOf<string[]>();

	// @ts-expect-error A multi-registration key requires getAll().
	container.get("handlers");
});

test("getAll() accepts only keys with multiple registrations", () => {
	expectTypeOf(container.getAll("handlers")).toEqualTypeOf<
		(HandlerA | HandlerB)[]
	>();

	// @ts-expect-error A single registration requires get().
	container.getAll("logger");
	// @ts-expect-error An array-valued single registration still requires get().
	container.getAll("languages");
	// @ts-expect-error Interface tokens hold one registration.
	container.getAll(LoggerToken);
});

test("constructor dependencies receive a multi-registration as an array", () => {
	new ContainerBuilder()
		.addSingleton("handlers", HandlerA)
		.registerSingleton("bus", EventBus, "handlers");

	new ContainerBuilder()
		.addSingleton("handlers", HandlerA)
		// @ts-expect-error An array of handlers does not match a Logger parameter.
		.registerSingleton("logger-only", LoggerOnly, "handlers");
});

test("factories resolve multi-registrations through getAll()", () => {
	new ContainerBuilder()
		.addSingleton("handlers", HandlerA)
		.registerSingletonFactory("count", (current) => {
			expectTypeOf(current.getAll("handlers")).toEqualTypeOf<HandlerA[]>();
			// @ts-expect-error Factories also use getAll() for multi-registrations.
			current.get("handlers");
			return 1;
		});
});

test("a register*() key typed any accepts only get()", () => {
	const raw = '{"debug":true}';
	const parsed = new ContainerBuilder()
		.registerSingletonFactory("cfg", () => JSON.parse(raw))
		.build();

	expectTypeOf(parsed.get("cfg")).toBeAny();
	// @ts-expect-error A register*() key typed any still requires get().
	parsed.getAll("cfg");
});

test("an add*() key with services typed any accepts only getAll()", () => {
	const raw = '{"debug":true}';
	const parsed = new ContainerBuilder()
		.addSingletonFactory("configs", () => JSON.parse(raw))
		.build();

	expectTypeOf(parsed.getAll("configs")).toEqualTypeOf<any[]>();
	// @ts-expect-error An add*() key typed any still requires getAll().
	parsed.get("configs");
});

test("a register*() key typed never accepts only get()", () => {
	const placeholder = new ContainerBuilder()
		.registerSingletonFactory("todo", (): never => {
			throw new Error("not implemented");
		})
		.build();

	expectTypeOf(placeholder.get("todo")).toBeNever();
	// @ts-expect-error A register*() key typed never still requires get().
	placeholder.getAll("todo");
});

test("the registry marks multi-registration keys", () => {
	const typed: ServiceContainer<{
		logger: Logger;
		handlers: MultiRegistration<Handler>;
	}> = new ContainerBuilder()
		.registerSingleton("logger", Logger)
		.addSingleton("handlers", HandlerA)
		.build();

	expectTypeOf(typed.getAll("handlers")).toEqualTypeOf<Handler[]>();
	expectTypeOf(typed.get("logger")).toEqualTypeOf<Logger>();
});

test("borrowing accepts only single registrations", () => {
	new ContainerBuilder()
		// @ts-expect-error A multi-registration key cannot be borrowed.
		.borrowSingletonFrom(container, "handlers");
});

test("builder counts are numbers", () => {
	const builder = new ContainerBuilder().addSingleton("handlers", HandlerA);

	expectTypeOf(builder.keyCount).toEqualTypeOf<number>();
	expectTypeOf(builder.registrationCount).toEqualTypeOf<number>();
});

import { expectTypeOf, test } from "vitest";
import {
	ContainerBuilder,
	interfaceToken,
	type RootServiceContainer,
	type TypeSafeServiceLocator,
} from "../src";

test("borrowSingletonFrom preserves string-key service types", () => {
	class Logger {}

	class Consumer {
		constructor(readonly logger: Logger) {}
	}

	const source = new ContainerBuilder()
		.registerSingleton("Logger", Logger)
		.build();
	const borrower = new ContainerBuilder()
		.borrowSingletonFrom(source, "Logger")
		.registerScoped("Consumer", Consumer, "Logger")
		.build();
	const sourceScope = source.startScope();

	expectTypeOf(source).toMatchTypeOf<
		RootServiceContainer<{ Logger: Logger }>
	>();
	expectTypeOf(sourceScope).toEqualTypeOf<
		TypeSafeServiceLocator<{ Logger: Logger }>
	>();
	expectTypeOf(borrower.get("Logger")).toEqualTypeOf<Logger>();
	expectTypeOf(borrower.get("Consumer")).toEqualTypeOf<Consumer>();

	// @ts-expect-error Only a root container can lend an owned singleton.
	new ContainerBuilder().borrowSingletonFrom(sourceScope, "Logger");

	// @ts-expect-error The source does not register this key.
	new ContainerBuilder().borrowSingletonFrom(source, "Missing");

	const broadKey: string = "Logger";
	// @ts-expect-error A broad string does not identify one source registration.
	new ContainerBuilder().borrowSingletonFrom(source, broadKey);

	const unionKey: "Logger" | "Missing" = "Logger" as "Logger" | "Missing";
	// @ts-expect-error Every possible key must be registered in the source.
	new ContainerBuilder().borrowSingletonFrom(source, unionKey);
});

test("borrowSingletonFrom preserves interface-token service types", () => {
	interface Clock {
		now(): number;
	}

	class SystemClock implements Clock {
		now(): number {
			return Date.now();
		}
	}

	const Clock = interfaceToken<Clock>()("Clock");
	const WrongClock = interfaceToken<{ timezone(): string }>()("Clock");
	const MissingClock = interfaceToken<Clock>()("MissingClock");
	const source = new ContainerBuilder()
		.registerSingletonInterface(Clock, SystemClock)
		.build();
	const borrower = new ContainerBuilder()
		.borrowSingletonFrom(source, Clock)
		.build();

	expectTypeOf(borrower.get(Clock)).toEqualTypeOf<Clock>();

	// @ts-expect-error The token service type does not match the source registration.
	new ContainerBuilder().borrowSingletonFrom(source, WrongClock);
	// @ts-expect-error The source does not register this token.
	new ContainerBuilder().borrowSingletonFrom(source, MissingClock);
});

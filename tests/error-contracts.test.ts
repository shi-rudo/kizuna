import { describe, expect, it } from "vitest";
import {
	BuilderAlreadyBuiltError,
	CircularDependencyError,
	ContainerBuilder,
	ContainerDisposedError,
	DisposalError,
	InvalidBuildOptionsError,
	InvalidServiceKeyError,
	RegistrationConflictError,
	RegistrationKindError,
	ServiceNotRegisteredError,
	ServiceResolutionError,
	SingletonBorrowError,
} from "../src";

class Logger {}
class Plugin {}

const captureError = (action: () => unknown): unknown => {
	try {
		action();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
};

type Untyped = {
	get(key: unknown): unknown;
	getAll(key: unknown): unknown;
};

const untyped = (container: unknown): Untyped => container as Untyped;

describe("resolution error contracts", () => {
	it("reports an unregistered key with SERVICE_NOT_REGISTERED", () => {
		const container = new ContainerBuilder().build();

		const error = captureError(() => untyped(container).get("missing"));

		expect(error).toBeInstanceOf(ServiceNotRegisteredError);
		expect(error).toMatchObject({
			code: "SERVICE_NOT_REGISTERED",
			key: "missing",
		});
	});

	it("reports an unregistered getAll() key with SERVICE_NOT_REGISTERED", () => {
		const container = new ContainerBuilder().build();

		const error = captureError(() => untyped(container).getAll("missing"));

		expect(error).toBeInstanceOf(ServiceNotRegisteredError);
		expect(error).toMatchObject({
			code: "SERVICE_NOT_REGISTERED",
			key: "missing",
		});
	});

	it("reports get() on a multi-registration key with REGISTRATION_KIND_MISMATCH", () => {
		const container = new ContainerBuilder()
			.addSingleton("plugins", Plugin)
			.build();

		const error = captureError(() => untyped(container).get("plugins"));

		expect(error).toBeInstanceOf(RegistrationKindError);
		expect(error).toMatchObject({
			code: "REGISTRATION_KIND_MISMATCH",
			key: "plugins",
			registrationKind: "multi",
		});
	});

	it("reports getAll() on a single registration with REGISTRATION_KIND_MISMATCH", () => {
		const container = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.build();

		const error = captureError(() => untyped(container).getAll("logger"));

		expect(error).toBeInstanceOf(RegistrationKindError);
		expect(error).toMatchObject({
			code: "REGISTRATION_KIND_MISMATCH",
			key: "logger",
			registrationKind: "single",
		});
	});

	it("wraps a failing factory once with SERVICE_RESOLUTION_FAILED", () => {
		const failure = new RangeError("factory failed");
		const container = new ContainerBuilder()
			.registerSingletonFactory("broken", () => {
				throw failure;
			})
			.build();

		const error = captureError(() => container.get("broken"));

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(error).toMatchObject({
			code: "SERVICE_RESOLUTION_FAILED",
			key: "broken",
		});
		expect((error as ServiceResolutionError).cause).toBe(failure);
	});

	it("wraps a failing multi-registration entry once with SERVICE_RESOLUTION_FAILED", () => {
		const failure = new RangeError("entry failed");
		const container = new ContainerBuilder()
			.addTransientFactory("plugins", () => {
				throw failure;
			})
			.build();

		const error = captureError(() => container.getAll("plugins"));

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(error).toMatchObject({
			code: "SERVICE_RESOLUTION_FAILED",
			key: "plugins",
		});
		expect((error as ServiceResolutionError).cause).toBe(failure);
	});

	it("keeps the failing dependency as the cause of the requested service", () => {
		class Consumer {
			constructor(readonly logger: Logger) {}
		}
		const container = new ContainerBuilder()
			.registerSingleton("consumer", Consumer, "logger" as never)
			.build({ validation: "deferred" });

		const error = captureError(() => container.get("consumer"));

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(error).toMatchObject({ key: "consumer" });
		expect((error as ServiceResolutionError).cause).toBeInstanceOf(
			ServiceNotRegisteredError,
		);
		expect((error as ServiceResolutionError).cause).toMatchObject({
			key: "logger",
		});
	});

	it("reports access to a disposed container with CONTAINER_DISPOSED", () => {
		const container = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.build();
		container.dispose();

		const error = captureError(() => container.get("logger"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(error).toMatchObject({ code: "CONTAINER_DISPOSED" });
	});

	it("wraps a singleton of a disposed root container for a live scope", () => {
		const container = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.build();
		const scope = container.startScope();
		container.dispose();

		const error = captureError(() => scope.get("logger"));

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(error).toMatchObject({ key: "logger" });
		expect((error as ServiceResolutionError).cause).toBeInstanceOf(
			ContainerDisposedError,
		);
	});

	it("keeps a code on circular dependency errors", () => {
		const container = new ContainerBuilder()
			.registerSingletonFactory(
				"a",
				(current) => untyped(current).get("a"),
				"a" as never,
			)
			.build({ validation: "deferred" });

		const error = captureError(() => container.get("a"));

		expect(error).toBeInstanceOf(CircularDependencyError);
		expect(error).toMatchObject({ code: "CIRCULAR_DEPENDENCY" });
	});

	it("keeps a code on disposal errors", () => {
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", () => ({
				dispose() {
					throw new Error("cleanup failed");
				},
			}))
			.build();
		container.get("resource");

		const error = captureError(() => container.dispose());

		expect(error).toBeInstanceOf(DisposalError);
		expect(error).toMatchObject({ code: "DISPOSAL_FAILED" });
	});
});

describe("registration error contracts", () => {
	it("reports a repeated register*() key with REGISTRATION_CONFLICT", () => {
		const builder = new ContainerBuilder().registerSingleton("logger", Logger);

		const error = captureError(() =>
			builder.registerSingleton("logger" as never, Logger),
		);

		expect(error).toBeInstanceOf(RegistrationConflictError);
		expect(error).toMatchObject({
			code: "REGISTRATION_CONFLICT",
			key: "logger",
			existingKind: "single",
			requestedKind: "single",
		});
	});

	it("reports add*() on a register*() key with REGISTRATION_CONFLICT", () => {
		const builder = new ContainerBuilder().registerSingleton("logger", Logger);

		const error = captureError(() =>
			builder.addSingleton("logger" as never, Logger),
		);

		expect(error).toBeInstanceOf(RegistrationConflictError);
		expect(error).toMatchObject({
			key: "logger",
			existingKind: "single",
			requestedKind: "multi",
		});
	});

	it("reports register*() on an add*() key with REGISTRATION_CONFLICT", () => {
		const builder = new ContainerBuilder().addSingleton("plugins", Plugin);

		const error = captureError(() =>
			builder.registerSingleton("plugins" as never, Plugin),
		);

		expect(error).toBeInstanceOf(RegistrationConflictError);
		expect(error).toMatchObject({
			key: "plugins",
			existingKind: "multi",
			requestedKind: "single",
		});
	});

	it("reports registration after build() with BUILDER_ALREADY_BUILT", () => {
		const builder = new ContainerBuilder();
		builder.build();

		const error = captureError(() =>
			builder.registerSingleton("logger", Logger),
		);

		expect(error).toBeInstanceOf(BuilderAlreadyBuiltError);
		expect(error).toMatchObject({ code: "BUILDER_ALREADY_BUILT" });
	});

	it("reports an empty registration key with INVALID_SERVICE_KEY", () => {
		const error = captureError(() =>
			new ContainerBuilder().registerSingleton("" as never, Logger),
		);

		expect(error).toBeInstanceOf(InvalidServiceKeyError);
		expect(error).toBeInstanceOf(TypeError);
		expect(error).toMatchObject({ code: "INVALID_SERVICE_KEY", key: "" });
	});

	it("reports an empty dependency key with INVALID_SERVICE_KEY", () => {
		class Consumer {
			constructor(readonly logger: Logger) {}
		}

		const error = captureError(() =>
			new ContainerBuilder()
				.registerSingleton("logger", Logger)
				.registerSingleton("consumer", Consumer, "" as never),
		);

		expect(error).toBeInstanceOf(InvalidServiceKeyError);
		expect(error).toBeInstanceOf(TypeError);
		expect(error).toMatchObject({ code: "INVALID_SERVICE_KEY", key: "" });
	});

	it("reports a resolution key that is not a string with INVALID_SERVICE_KEY", () => {
		const container = new ContainerBuilder().build();
		const key = Symbol("not-a-key");

		const error = captureError(() => untyped(container).get(key));

		expect(error).toBeInstanceOf(InvalidServiceKeyError);
		expect(error).toBeInstanceOf(TypeError);
		expect(error).toMatchObject({ code: "INVALID_SERVICE_KEY", key });
	});
});

describe("build option error contracts", () => {
	const buildWith = (options: unknown): unknown => {
		const builder = new ContainerBuilder();
		return (builder.build as (options: unknown) => unknown).call(
			builder,
			options,
		);
	};

	it("reports an unknown validation mode with INVALID_BUILD_OPTIONS", () => {
		const error = captureError(() => buildWith({ validation: "none" }));

		expect(error).toMatchObject({
			code: "INVALID_BUILD_OPTIONS",
			option: "validation",
		});
		expect(error).toBeInstanceOf(InvalidBuildOptionsError);
	});

	it("reports a diagnostics listener that is not a function with INVALID_BUILD_OPTIONS", () => {
		const error = captureError(() =>
			buildWith({ diagnostics: { listner: () => undefined } }),
		);

		expect(error).toMatchObject({
			code: "INVALID_BUILD_OPTIONS",
			option: "diagnostics.listener",
		});
	});

	it("reports an unknown diagnostics level with INVALID_BUILD_OPTIONS", () => {
		const error = captureError(() =>
			buildWith({ diagnostics: { listener: () => undefined, level: "info" } }),
		);

		expect(error).toMatchObject({
			code: "INVALID_BUILD_OPTIONS",
			option: "diagnostics.level",
		});
	});

	it("reports build options that are not an object with INVALID_BUILD_OPTIONS", () => {
		const error = captureError(() => buildWith(null));

		expect(error).toMatchObject({
			code: "INVALID_BUILD_OPTIONS",
			option: "options",
		});
	});

	it("reports a null validation mode with INVALID_BUILD_OPTIONS", () => {
		const error = captureError(() => buildWith({ validation: null }));

		expect(error).toMatchObject({
			code: "INVALID_BUILD_OPTIONS",
			option: "validation",
		});
	});

	it("reports diagnostics that are not an object with INVALID_BUILD_OPTIONS", () => {
		const error = captureError(() => buildWith({ diagnostics: null }));

		expect(error).toMatchObject({
			code: "INVALID_BUILD_OPTIONS",
			option: "diagnostics",
		});
	});

	it("reports a null diagnostics level with INVALID_BUILD_OPTIONS", () => {
		const error = captureError(() =>
			buildWith({ diagnostics: { listener: () => undefined, level: null } }),
		);

		expect(error).toMatchObject({
			code: "INVALID_BUILD_OPTIONS",
			option: "diagnostics.level",
		});
	});
});

describe("singleton borrowing error contracts", () => {
	const borrow = (source: unknown, key: string): unknown =>
		captureError(() =>
			new ContainerBuilder().borrowSingletonFrom(source as never, key as never),
		);

	const expectBorrowError = (error: unknown, key: string, reason: string) => {
		expect(error).toBeInstanceOf(SingletonBorrowError);
		expect(error).toMatchObject({
			code: "SINGLETON_BORROW_FAILED",
			key,
			reason,
		});
	};

	it("reports a scoped source registration as NOT_SINGLETON", () => {
		const source = new ContainerBuilder()
			.registerScoped("logger", Logger)
			.build();

		expectBorrowError(borrow(source, "logger"), "logger", "NOT_SINGLETON");
	});

	it("reports a multi-registration source key as MULTI_REGISTRATION", () => {
		const source = new ContainerBuilder()
			.addSingleton("plugins", Plugin)
			.build();

		expectBorrowError(
			borrow(source, "plugins"),
			"plugins",
			"MULTI_REGISTRATION",
		);
	});

	it("reports a missing source key as NOT_REGISTERED", () => {
		const source = new ContainerBuilder().build();

		expectBorrowError(borrow(source, "missing"), "missing", "NOT_REGISTERED");
	});

	it("reports a scope as the source as SOURCE_IS_SCOPE", () => {
		const owner = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.build();

		expectBorrowError(
			borrow(owner.startScope(), "logger"),
			"logger",
			"SOURCE_IS_SCOPE",
		);
	});

	it("reports a borrowed source registration as NOT_OWNED", () => {
		const owner = new ContainerBuilder()
			.registerSingleton("logger", Logger)
			.build();
		const firstBorrower = new ContainerBuilder()
			.borrowSingletonFrom(owner, "logger")
			.build();

		expectBorrowError(borrow(firstBorrower, "logger"), "logger", "NOT_OWNED");
	});

	it("reports an object that is not a Kizuna container as INCOMPATIBLE_SOURCE", () => {
		expectBorrowError(borrow({}, "logger"), "logger", "INCOMPATIBLE_SOURCE");
	});

	it("reports a malformed borrow capability as INVALID_REFERENCE", () => {
		const source = {
			[Symbol.for("@shirudo/kizuna.borrowable-source.v1")]() {
				return {};
			},
		};

		expectBorrowError(borrow(source, "logger"), "logger", "INVALID_REFERENCE");
	});
});

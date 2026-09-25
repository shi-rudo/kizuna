import { expectTypeOf, test } from "vitest";
import type {
	BuilderAlreadyBuiltError,
	CircularDependencyError,
	ContainerDisposedError,
	ContainerValidationError,
	DisposalError,
	InvalidBuildOptionsError,
	InvalidServiceKeyError,
	RegistrationConflictError,
	RegistrationKind,
	RegistrationKindError,
	ServiceNotRegisteredError,
	ServiceResolutionError,
	SingletonBorrowError,
	SingletonBorrowFailureReason,
} from "../src";

test("every error class exposes a literal code", () => {
	expectTypeOf<
		ServiceNotRegisteredError["code"]
	>().toEqualTypeOf<"SERVICE_NOT_REGISTERED">();
	expectTypeOf<
		RegistrationKindError["code"]
	>().toEqualTypeOf<"REGISTRATION_KIND_MISMATCH">();
	expectTypeOf<
		ServiceResolutionError["code"]
	>().toEqualTypeOf<"SERVICE_RESOLUTION_FAILED">();
	expectTypeOf<
		ContainerDisposedError["code"]
	>().toEqualTypeOf<"CONTAINER_DISPOSED">();
	expectTypeOf<
		RegistrationConflictError["code"]
	>().toEqualTypeOf<"REGISTRATION_CONFLICT">();
	expectTypeOf<
		BuilderAlreadyBuiltError["code"]
	>().toEqualTypeOf<"BUILDER_ALREADY_BUILT">();
	expectTypeOf<
		InvalidServiceKeyError["code"]
	>().toEqualTypeOf<"INVALID_SERVICE_KEY">();
	expectTypeOf<
		InvalidBuildOptionsError["code"]
	>().toEqualTypeOf<"INVALID_BUILD_OPTIONS">();
	expectTypeOf<
		SingletonBorrowError["code"]
	>().toEqualTypeOf<"SINGLETON_BORROW_FAILED">();
	expectTypeOf<
		CircularDependencyError["code"]
	>().toEqualTypeOf<"CIRCULAR_DEPENDENCY">();
	expectTypeOf<DisposalError["code"]>().toEqualTypeOf<"DISPOSAL_FAILED">();
	expectTypeOf<
		ContainerValidationError["code"]
	>().toEqualTypeOf<"CONTAINER_VALIDATION_FAILED">();
});

test("fields that callers branch on have closed types", () => {
	expectTypeOf<RegistrationKind>().toEqualTypeOf<"single" | "multi">();
	expectTypeOf<
		RegistrationKindError["registrationKind"]
	>().toEqualTypeOf<RegistrationKind>();
	expectTypeOf<
		RegistrationConflictError["existingKind"]
	>().toEqualTypeOf<RegistrationKind>();
	expectTypeOf<
		SingletonBorrowError["reason"]
	>().toEqualTypeOf<SingletonBorrowFailureReason>();
	expectTypeOf<SingletonBorrowFailureReason>().toEqualTypeOf<
		| "INCOMPATIBLE_SOURCE"
		| "INVALID_REFERENCE"
		| "SOURCE_IS_SCOPE"
		| "MULTI_REGISTRATION"
		| "NOT_REGISTERED"
		| "NOT_SINGLETON"
		| "NOT_OWNED"
	>();
});

test("an invalid key error is a TypeError", () => {
	expectTypeOf<InvalidServiceKeyError>().toMatchTypeOf<TypeError>();
});

test("an invalid build options error is a TypeError", () => {
	expectTypeOf<InvalidBuildOptionsError>().toMatchTypeOf<TypeError>();
});

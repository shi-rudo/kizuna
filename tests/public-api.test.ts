import { describe, expect, it } from "vitest";
import * as PublicApi from "../src";

describe("public package API", () => {
	it("exports only the stable runtime surface", () => {
		expect(Object.keys(PublicApi).sort()).toEqual([
			"BuilderAlreadyBuiltError",
			"CircularDependencyError",
			"ContainerBuilder",
			"ContainerDisposedError",
			"ContainerValidationError",
			"DisposalError",
			"InvalidServiceKeyError",
			"RegistrationConflictError",
			"RegistrationKindError",
			"ServiceContainerToken",
			"ServiceNotRegisteredError",
			"ServiceProviderToken",
			"ServiceResolutionError",
			"SingletonBorrowError",
			"interfaceToken",
		]);
	});
});

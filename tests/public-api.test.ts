import { describe, expect, it } from "vitest";
import * as PublicApi from "../src";

describe("public package API", () => {
	it("exports only the stable runtime surface", () => {
		expect(Object.keys(PublicApi).sort()).toEqual([
			"CircularDependencyError",
			"ContainerBuilder",
			"ServiceProviderToken",
			"interfaceToken",
		]);
	});
});

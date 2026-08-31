import { describe, expect, it } from "vitest";
import {
	type RegistrationSnapshot,
	validateRegistrationGraph,
} from "../src/api/registration-graph";

describe("registration graph snapshots", () => {
	it("validates immutable registration data without lifecycle objects", () => {
		const snapshots: readonly RegistrationSnapshot[] = [
			{
				dependencies: ["missing"],
				disposed: false,
				key: "consumer",
				lifetime: "singleton",
			},
		];

		expect(validateRegistrationGraph(snapshots)).toEqual([
			expect.objectContaining({
				code: "MISSING_DEPENDENCY",
				dependencyKey: "missing",
				path: ["consumer", "missing"],
			}),
		]);
	});
});

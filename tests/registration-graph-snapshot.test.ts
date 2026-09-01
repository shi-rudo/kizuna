import { describe, expect, it } from "vitest";
import { validateRegistrationGraph } from "../src/api/registration-graph";
import {
	createRegistrationSnapshots,
	type RegistrationSnapshot,
} from "../src/api/registration-snapshots";
import { ScopedLifecycle } from "../src/core/scopes/scoped";
import { SingletonLifecycle } from "../src/core/scopes/singleton";
import { TransientLifecycle } from "../src/core/scopes/transient";
import { ServiceWrapper } from "../src/core/services/service-wrapper";

describe("registration graph snapshots", () => {
	it("validates snapshot values without lifecycle objects", () => {
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

	it("copies single and multi-registrations into deeply frozen snapshots", () => {
		const single = new ServiceWrapper(
			"single-wrapper",
			new SingletonLifecycle(),
			["dependency"],
		);
		const firstMulti = new ServiceWrapper(
			"first-multi-wrapper",
			new ScopedLifecycle(),
			[],
		);
		const secondMulti = new ServiceWrapper(
			"second-multi-wrapper",
			new TransientLifecycle(),
			["single"],
		);
		firstMulti.dispose();

		const snapshots = createRegistrationSnapshots(
			new Map([["single", single]]),
			new Map([["plugins", [firstMulti, secondMulti]]]),
		);

		expect(snapshots).toEqual([
			{
				dependencies: ["dependency"],
				disposed: false,
				key: "single",
				lifetime: "singleton",
			},
			{
				dependencies: [],
				disposed: true,
				key: "plugins",
				lifetime: "scoped",
				registrationIndex: 0,
			},
			{
				dependencies: ["single"],
				disposed: false,
				key: "plugins",
				lifetime: "transient",
				registrationIndex: 1,
			},
		]);
		expect(Object.isFrozen(snapshots)).toBe(true);
		for (const snapshot of snapshots) {
			expect(Object.isFrozen(snapshot)).toBe(true);
			expect(Object.isFrozen(snapshot.dependencies)).toBe(true);
		}
	});
});

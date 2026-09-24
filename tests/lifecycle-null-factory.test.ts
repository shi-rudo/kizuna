import { describe, expect, it } from "vitest";
import { ScopedLifecycle } from "../src/core/scopes/scoped";
import { SingletonLifecycle } from "../src/core/scopes/singleton";

const noArguments = (): readonly unknown[] => [];

describe("Lifecycle null factory return", () => {
	describe("SingletonLifecycle", () => {
		it("should cache null when factory returns null", () => {
			const lifecycle = new SingletonLifecycle();
			let callCount = 0;
			lifecycle.setFactory(() => {
				callCount++;
				return null;
			});

			const first = lifecycle.getInstance(noArguments);
			const second = lifecycle.getInstance(noArguments);

			expect(first).toBeNull();
			expect(second).toBeNull();
			expect(callCount).toBe(1);
		});

		it("should cache undefined when factory returns undefined", () => {
			const lifecycle = new SingletonLifecycle();
			let callCount = 0;
			lifecycle.setFactory(() => {
				callCount++;
				return undefined;
			});

			const first = lifecycle.getInstance(noArguments);
			const second = lifecycle.getInstance(noArguments);

			expect(first).toBeUndefined();
			expect(second).toBeUndefined();
			expect(callCount).toBe(1);
		});
	});

	describe("ScopedLifecycle", () => {
		it("should cache null when factory returns null", () => {
			const lifecycle = new ScopedLifecycle();
			let callCount = 0;
			lifecycle.setFactory(() => {
				callCount++;
				return null;
			});

			const first = lifecycle.getInstance(noArguments);
			const second = lifecycle.getInstance(noArguments);

			expect(first).toBeNull();
			expect(second).toBeNull();
			expect(callCount).toBe(1);
		});

		it("should cache undefined when factory returns undefined", () => {
			const lifecycle = new ScopedLifecycle();
			let callCount = 0;
			lifecycle.setFactory(() => {
				callCount++;
				return undefined;
			});

			const first = lifecycle.getInstance(noArguments);
			const second = lifecycle.getInstance(noArguments);

			expect(first).toBeUndefined();
			expect(second).toBeUndefined();
			expect(callCount).toBe(1);
		});
	});
});

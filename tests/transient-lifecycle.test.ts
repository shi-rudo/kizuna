import { describe, expect, it, vi } from "vitest";
import { ContainerDisposedError } from "../src/core/errors";
import { TransientLifecycle } from "../src/core/scopes/transient";

const noArguments = (): readonly unknown[] => [];

const captureError = (action: () => unknown): unknown => {
	try {
		action();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
};

describe("transient lifecycle", () => {
	it("reports its lifetime and does not track its values", () => {
		const lifecycle = new TransientLifecycle();

		expect(lifecycle.lifetime).toBe("transient");
		expect(lifecycle.valueOwnership).toBe("untracked");
		expect(lifecycle.isDisposed).toBe(false);
	});

	it("does not call the factory before the first request", () => {
		const lifecycle = new TransientLifecycle();
		const factory = vi.fn(() => ({}));

		lifecycle.setFactory(factory);

		expect(factory).not.toHaveBeenCalled();
	});

	it("creates a new instance from the arguments of each request", () => {
		const lifecycle = new TransientLifecycle();
		lifecycle.setFactory((name: string) => ({ name }));
		const first = lifecycle.getInstance(() => ["first"]);

		const second = lifecycle.getInstance(() => ["second"]);

		expect(second).not.toBe(first);
		expect([first, second]).toEqual([{ name: "first" }, { name: "second" }]);
	});

	it("rejects a factory that is not a function", () => {
		const lifecycle = new TransientLifecycle();

		expect(() => lifecycle.setFactory(null as never)).toThrow(
			"Factory must be a valid function",
		);
	});

	it("requires a factory before resolution", () => {
		const lifecycle = new TransientLifecycle();

		expect(() => lifecycle.getInstance(noArguments)).toThrow(
			"No factory registered for this lifecycle",
		);
	});

	it("rethrows a factory error unchanged", () => {
		const lifecycle = new TransientLifecycle();
		const failure = new Error("boom");
		lifecycle.setFactory(() => {
			throw failure;
		});

		expect(captureError(() => lifecycle.getInstance(noArguments))).toBe(
			failure,
		);
	});

	it("rejects resolution after close without resolving arguments", () => {
		const lifecycle = new TransientLifecycle();
		const resolveArguments = vi.fn(noArguments);
		lifecycle.setFactory(() => ({}));
		lifecycle.close("sync");

		const error = captureError(() => lifecycle.getInstance(resolveArguments));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(resolveArguments).not.toHaveBeenCalled();
	});

	it("does not call the factory when the arguments close the lifecycle", () => {
		const lifecycle = new TransientLifecycle();
		const factory = vi.fn(() => ({}));
		lifecycle.setFactory(factory);

		const error = captureError(() =>
			lifecycle.getInstance(() => {
				lifecycle.close("sync");
				return [];
			}),
		);

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(factory).not.toHaveBeenCalled();
	});

	it("blocks later use after dispose()", () => {
		const lifecycle = new TransientLifecycle();
		lifecycle.setFactory(() => ({}));

		lifecycle.dispose();
		lifecycle.dispose();

		expect(lifecycle.isDisposed).toBe(true);
		expect(() => lifecycle.getInstance(noArguments)).toThrow(
			"Cannot resolve from a disposed transient lifecycle",
		);
		expect(() => lifecycle.setFactory(() => ({}))).toThrow(
			"Cannot set factory on a disposed transient lifecycle",
		);
	});

	it("blocks later use after disposeAsync()", async () => {
		const lifecycle = new TransientLifecycle();
		lifecycle.setFactory(() => ({}));

		await lifecycle.disposeAsync();

		expect(lifecycle.isDisposed).toBe(true);
		expect(() => lifecycle.getInstance(noArguments)).toThrow(
			ContainerDisposedError,
		);
	});
});

describe("transient lifecycle scopes", () => {
	it("creates an independent lifecycle with the same factory", () => {
		const lifecycle = new TransientLifecycle();
		const factory = vi.fn(() => ({}));
		lifecycle.setFactory(factory);

		const scope = lifecycle.createScope();
		lifecycle.dispose();

		expect(scope).not.toBe(lifecycle);
		expect(scope.getInstance(noArguments)).toEqual({});
		expect(factory).toHaveBeenCalledTimes(1);
	});

	it("cannot create a scope after disposal", () => {
		const lifecycle = new TransientLifecycle();
		lifecycle.setFactory(() => ({}));
		lifecycle.dispose();

		expect(() => lifecycle.createScope()).toThrow(
			"Cannot create new scope from disposed lifecycle",
		);
	});

	it("cannot create a scope without a factory", () => {
		const lifecycle = new TransientLifecycle();

		expect(() => lifecycle.createScope()).toThrow(
			"No factory available to create new scope",
		);
	});
});

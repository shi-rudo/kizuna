import { describe, expect, it, vi } from "vitest";
import type { InstanceRequest } from "../src/core/contracts";
import { CircularDependencyError } from "../src/core/errors";
import { ScopedLifecycle } from "../src/core/scopes/scoped";
import { SingletonLifecycle } from "../src/core/scopes/singleton";

const cachingLifecycles = [
	{ lifetime: "singleton", create: () => new SingletonLifecycle() },
	{ lifetime: "scoped", create: () => new ScopedLifecycle() },
] as const;

const requestWith = (...args: unknown[]): InstanceRequest => ({
	factoryArguments: () => args,
	valueCreated: () => undefined,
});

const noArguments = requestWith();

const captureError = (action: () => unknown): unknown => {
	try {
		action();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
};

describe.each(cachingLifecycles)("$lifetime lifecycle caching", ({
	lifetime,
	create,
}) => {
	it("reports its lifetime and owns its values", () => {
		const lifecycle = create();

		expect(lifecycle.lifetime).toBe(lifetime);
		expect(lifecycle.valueOwnership).toBe("owned");
		expect(lifecycle.isDisposed).toBe(false);
	});

	it("does not call the factory before the first request", () => {
		const lifecycle = create();
		const factory = vi.fn(() => ({}));

		lifecycle.setFactory(factory);

		expect(factory).not.toHaveBeenCalled();
	});

	it("creates the instance once and does not resolve arguments again", () => {
		const lifecycle = create();
		const factory = vi.fn((name: string) => ({ name }));
		lifecycle.setFactory(factory);

		const first = lifecycle.getInstance(requestWith("first"));
		const second = lifecycle.getInstance(requestWith("second"));

		expect(second).toBe(first);
		expect(first).toEqual({ name: "first" });
		expect(factory).toHaveBeenCalledTimes(1);
	});

	it("rejects a factory that is not a function", () => {
		expect(() => create().setFactory(null as never)).toThrow(
			"Factory must be a valid function",
		);
	});

	it("requires a factory before resolution", () => {
		expect(() => create().getInstance(noArguments)).toThrow(
			"No factory registered for this lifecycle",
		);
	});

	it("rethrows a factory error unchanged and retries on the next request", () => {
		const lifecycle = create();
		const failure = new Error("boom");
		const factory = vi
			.fn()
			.mockImplementationOnce(() => {
				throw failure;
			})
			.mockReturnValue("value");
		lifecycle.setFactory(factory);

		const error = captureError(() => lifecycle.getInstance(noArguments));

		expect(error).toBe(failure);
		expect(lifecycle.getInstance(noArguments)).toBe("value");
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("rethrows a thrown value that is not an Error unchanged", () => {
		const lifecycle = create();
		lifecycle.setFactory(() => {
			throw "offline";
		});

		expect(captureError(() => lifecycle.getInstance(noArguments))).toBe(
			"offline",
		);
	});

	it("passes a circular dependency error through unchanged", () => {
		const lifecycle = create();
		const cycle = new CircularDependencyError(["a", "b", "a"]);
		lifecycle.setFactory(() => {
			throw cycle;
		});

		expect(captureError(() => lifecycle.getInstance(noArguments))).toBe(cycle);
	});

	it("clears a rejected factory Promise and calls the factory again", async () => {
		const lifecycle = create();
		const factory = vi
			.fn()
			.mockImplementationOnce(() => Promise.reject(new Error("offline")))
			.mockImplementation(() => Promise.resolve("online"));
		lifecycle.setFactory(factory);

		await expect(lifecycle.getInstance(noArguments)).rejects.toThrow("offline");
		await expect(lifecycle.getInstance(noArguments)).resolves.toBe("online");
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("keeps a fulfilled factory Promise cached", async () => {
		const lifecycle = create();
		const factory = vi.fn(() => Promise.resolve({}));
		lifecycle.setFactory(factory);

		const first = lifecycle.getInstance<Promise<object>>(noArguments);
		await first;

		expect(lifecycle.getInstance(noArguments)).toBe(first);
		expect(factory).toHaveBeenCalledTimes(1);
	});

	it("does not create an instance during disposal", () => {
		const lifecycle = create();
		const factory = vi.fn(() => ({}));
		lifecycle.setFactory(factory);

		lifecycle.dispose();

		expect(factory).not.toHaveBeenCalled();
		expect(lifecycle.isDisposed).toBe(true);
	});

	it("disposes the cached instance once and blocks later use", () => {
		const lifecycle = create();
		const cleanup = vi.fn();
		lifecycle.setFactory(() => ({ dispose: cleanup }));
		lifecycle.getInstance(noArguments);

		lifecycle.dispose();
		lifecycle.dispose();

		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(lifecycle.isDisposed).toBe(true);
		expect(() => lifecycle.getInstance(noArguments)).toThrow(
			`Cannot resolve from a disposed ${lifetime} lifecycle`,
		);
		expect(() => lifecycle.setFactory(() => ({}))).toThrow(
			`Cannot set factory on a disposed ${lifetime} lifecycle`,
		);
	});

	it("stays disposed when the cleanup hook throws", () => {
		const lifecycle = create();
		const cleanup = vi.fn(() => {
			throw new Error("cleanup failed");
		});
		lifecycle.setFactory(() => ({ dispose: cleanup }));
		lifecycle.getInstance(noArguments);

		expect(() => lifecycle.dispose()).toThrow("cleanup failed");
		lifecycle.dispose();

		expect(lifecycle.isDisposed).toBe(true);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("rejects asynchronous cleanup on the synchronous path", () => {
		const lifecycle = create();
		lifecycle.setFactory(() => ({
			async [Symbol.asyncDispose]() {},
		}));
		lifecycle.getInstance(noArguments);

		expect(() => lifecycle.dispose()).toThrow(TypeError);
		expect(lifecycle.isDisposed).toBe(true);
	});

	it("awaits asynchronous cleanup once", async () => {
		const lifecycle = create();
		const events: string[] = [];
		lifecycle.setFactory(() => ({
			async [Symbol.asyncDispose]() {
				await Promise.resolve();
				events.push("disposed");
			},
		}));
		lifecycle.getInstance(noArguments);

		await lifecycle.disposeAsync();
		await lifecycle.disposeAsync();

		expect(events).toEqual(["disposed"]);
		expect(() => lifecycle.getInstance(noArguments)).toThrow(
			`Cannot resolve from a disposed ${lifetime} lifecycle`,
		);
	});

	it("disposes the resolved value of a cached factory Promise", async () => {
		const lifecycle = create();
		const cleanup = vi.fn();
		lifecycle.setFactory(() => Promise.resolve({ dispose: cleanup }));
		lifecycle.getInstance(noArguments);

		await lifecycle.disposeAsync();

		expect(cleanup).toHaveBeenCalledTimes(1);
	});
});

describe("singleton lifecycle scopes", () => {
	it("shares itself with every scope", () => {
		const lifecycle = new SingletonLifecycle();
		lifecycle.setFactory(() => ({}));

		expect(lifecycle.createScope()).toBe(lifecycle);
	});

	it("returns itself without a factory and after disposal", () => {
		const lifecycle = new SingletonLifecycle();

		expect(lifecycle.createScope()).toBe(lifecycle);
		lifecycle.dispose();
		expect(lifecycle.createScope()).toBe(lifecycle);
	});
});

describe("scoped lifecycle scopes", () => {
	it("creates an independent lifecycle with the same factory", () => {
		const lifecycle = new ScopedLifecycle();
		const factory = vi.fn(() => ({}));
		lifecycle.setFactory(factory);
		const parentValue = lifecycle.getInstance(noArguments);

		const scope = lifecycle.createScope();
		const scopeValue = scope.getInstance(noArguments);

		expect(scope).toBeInstanceOf(ScopedLifecycle);
		expect(scope).not.toBe(lifecycle);
		expect(scopeValue).not.toBe(parentValue);
		expect(scope.getInstance(noArguments)).toBe(scopeValue);
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("keeps the parent usable after a scope is disposed", () => {
		const lifecycle = new ScopedLifecycle();
		lifecycle.setFactory(() => ({}));
		const parentValue = lifecycle.getInstance(noArguments);
		const scope = lifecycle.createScope();

		scope.dispose();

		expect(lifecycle.isDisposed).toBe(false);
		expect(lifecycle.getInstance(noArguments)).toBe(parentValue);
	});

	it("requires a factory to create a scope", () => {
		expect(() => new ScopedLifecycle().createScope()).toThrow(
			"No factory available to create new scope",
		);
	});

	it("rejects scope creation after disposal", () => {
		const lifecycle = new ScopedLifecycle();
		lifecycle.setFactory(() => ({}));
		lifecycle.dispose();

		expect(() => lifecycle.createScope()).toThrow(
			"Cannot create new scope from disposed lifecycle",
		);
	});
});

import { describe, expect, it, vi } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";
import { DisposalError } from "../src/core/errors";

class AsyncDisposableService {
	disposed = false;
	disposeCalls = 0;
	disposeResolvedAt: number | null = null;

	async dispose(): Promise<void> {
		this.disposeCalls++;
		// Simulate async cleanup (e.g. await pool.end())
		await new Promise((resolve) => setTimeout(resolve, 10));
		this.disposed = true;
		this.disposeResolvedAt = Date.now();
	}
}

class SyncDisposableService {
	disposed = false;
	dispose(): void {
		this.disposed = true;
	}
}

class SymbolAsyncDisposableService {
	disposed = false;
	async [Symbol.asyncDispose](): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, 5));
		this.disposed = true;
	}
}

class NonDisposableService {
	value = 42;
}

class ThrowingAsyncDisposable {
	async dispose(): Promise<void> {
		throw new Error("async dispose boom");
	}
}

describe("disposeAsync()", () => {
	it("awaits a service-owned async dispose before resolving", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", AsyncDisposableService)
			.build();

		const svc = container.get("service");
		expect(svc.disposed).toBe(false);

		await container.disposeAsync();
		expect(svc.disposed).toBe(true);
		expect(svc.disposeCalls).toBe(1);
	});

	it("awaits multiple async disposals in parallel", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("a", AsyncDisposableService)
			.registerSingleton("b", AsyncDisposableService)
			.build();

		const a = container.get("a");
		const b = container.get("b");

		const start = Date.now();
		await container.disposeAsync();
		const elapsed = Date.now() - start;

		expect(a.disposed).toBe(true);
		expect(b.disposed).toBe(true);
		// Parallel: ~10ms each, not 20ms sequential. Give generous slack for CI.
		expect(elapsed).toBeLessThan(50);
	});

	it("continues disposing other services before it reports a rejection", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const container = new ContainerBuilder()
			.registerSingleton("bad", ThrowingAsyncDisposable)
			.registerSingleton("good", AsyncDisposableService)
			.build();

		container.get("bad");
		const good = container.get("good");

		await expect(container.disposeAsync()).rejects.toMatchObject({
			errors: [expect.objectContaining({ message: "async dispose boom" })],
		});
		expect(good.disposed).toBe(true);
		expect(errorSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();

		errorSpy.mockRestore();
		warnSpy.mockRestore();
	});

	it("is idempotent — second call is a no-op", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", AsyncDisposableService)
			.build();

		const svc = container.get("service");
		await container.disposeAsync();
		expect(svc.disposeCalls).toBe(1);

		await container.disposeAsync();
		expect(svc.disposeCalls).toBe(1);
	});

	it("marks the container disposed (subsequent get() throws)", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", NonDisposableService)
			.build();

		await container.disposeAsync();
		expect(() => container.get("service")).toThrow(/disposed container/);
	});

	it("handles sync-only dispose methods correctly", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", SyncDisposableService)
			.build();

		const svc = container.get("service");
		await container.disposeAsync();
		expect(svc.disposed).toBe(true);
	});

	it("handles services without any dispose method", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", NonDisposableService)
			.build();

		container.get("service");
		await expect(container.disposeAsync()).resolves.toBeUndefined();
	});

	it("prefers Symbol.asyncDispose over dispose()", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", SymbolAsyncDisposableService)
			.build();

		const svc = container.get("service");
		await container.disposeAsync();
		expect(svc.disposed).toBe(true);
	});

	it("disposes scoped instances asynchronously", async () => {
		const container = new ContainerBuilder()
			.registerScoped("service", AsyncDisposableService)
			.build();

		const scope = container.startScope();
		const svc = scope.get("service");

		await scope.disposeAsync();
		expect(svc.disposed).toBe(true);
	});

	it("disposes multi-registrations asynchronously", async () => {
		const container = new ContainerBuilder()
			.addSingleton("services", AsyncDisposableService)
			.addSingleton("services", AsyncDisposableService)
			.build();

		const instances = container.getAll("services");
		expect(instances).toHaveLength(2);

		await container.disposeAsync();
		for (const svc of instances) {
			expect(svc.disposed).toBe(true);
		}
	});
});

/** A service whose async cleanup ends only when the test finishes or fails it. */
class GatedCleanup {
	finished = false;
	private settle: { finish(): void; fail(error: Error): void } | undefined;

	async [Symbol.asyncDispose](): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			this.settle = { finish: resolve, fail: reject };
		});
		this.finished = true;
	}

	finish(): void {
		this.settle?.finish();
	}

	fail(error: Error): void {
		this.settle?.fail(error);
	}
}

const outcome = (promise: Promise<void>): Promise<unknown> =>
	promise.then(
		() => "resolved",
		(error: unknown) => error,
	);

const flushMicrotasks = async (): Promise<void> => {
	for (let round = 0; round < 10; round++) {
		await Promise.resolve();
	}
};

describe("concurrent disposeAsync() calls", () => {
	it("does not settle a second call before the running cleanup finishes", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("resource", GatedCleanup)
			.build();
		const resource = container.get("resource");
		const first = container.disposeAsync();
		let secondSettled = false;
		const second = container.disposeAsync().then(() => {
			secondSettled = true;
		});

		await flushMicrotasks();

		expect(secondSettled).toBe(false);
		resource.finish();
		await Promise.all([first, second]);
	});

	it("settles every concurrent call once the cleanup finishes", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("resource", GatedCleanup)
			.build();
		const resource = container.get("resource");
		const calls = [container.disposeAsync(), container.disposeAsync()];
		await flushMicrotasks();

		resource.finish();

		await expect(Promise.all(calls)).resolves.toEqual([undefined, undefined]);
		expect(resource.finished).toBe(true);
	});

	it("rejects every concurrent call with the same DisposalError", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("resource", GatedCleanup)
			.build();
		const resource = container.get("resource");
		const first = outcome(container.disposeAsync());
		const second = outcome(container.disposeAsync());
		await flushMicrotasks();

		resource.fail(new Error("close failed"));

		const [firstError, secondError] = await Promise.all([first, second]);
		expect(firstError).toBeInstanceOf(DisposalError);
		expect(secondError).toBe(firstError);
	});

	it("resolves a call after a failed disposal without running cleanup again", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("resource", GatedCleanup)
			.build();
		const resource = container.get("resource");
		const failed = outcome(container.disposeAsync());
		await flushMicrotasks();
		resource.fail(new Error("close failed"));
		await failed;

		const later = container.disposeAsync();

		await expect(later).resolves.toBeUndefined();
	});
});

describe("Symbol.dispose / Symbol.asyncDispose on container", () => {
	it("exposes Symbol.dispose as alias for dispose()", () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", SyncDisposableService)
			.build();

		const svc = container.get("service");
		(container as Disposable)[Symbol.dispose]();
		expect(svc.disposed).toBe(true);
	});

	it("exposes Symbol.asyncDispose as alias for disposeAsync()", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", AsyncDisposableService)
			.build();

		const svc = container.get("service");
		await (container as AsyncDisposable)[Symbol.asyncDispose]();
		expect(svc.disposed).toBe(true);
	});

	it("supports `using` syntax with sync disposal", () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", SyncDisposableService)
			.build();

		const svc = container.get("service");

		{
			using _ = container as Disposable;
			// Container in use here
		}

		expect(svc.disposed).toBe(true);
	});

	it("supports `await using` syntax with async disposal", async () => {
		const container = new ContainerBuilder()
			.registerSingleton("service", AsyncDisposableService)
			.build();

		const svc = container.get("service");

		{
			await using _ = container as AsyncDisposable;
			// Container in use here
		}

		expect(svc.disposed).toBe(true);
	});
});

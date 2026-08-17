import { describe, expect, it } from "vitest";
import { ContainerBuilder, DisposalError } from "../src";

describe("function-valued service disposal", () => {
	it("disposes a singleton function through Symbol.dispose exactly once", () => {
		let disposeCalls = 0;
		const service = Object.assign(() => "ready", {
			[Symbol.dispose](): void {
				disposeCalls++;
			},
		});
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => service)
			.build();

		expect(container.get("service")()).toBe("ready");
		container.dispose();
		container.dispose();

		expect(disposeCalls).toBe(1);
	});

	it("disposes a singleton function through dispose exactly once", () => {
		let disposeCalls = 0;
		const service = Object.assign(() => "ready", {
			dispose(): void {
				disposeCalls++;
			},
		});
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => service)
			.build();

		container.get("service");
		container.dispose();
		container.dispose();

		expect(disposeCalls).toBe(1);
	});

	it("disposes a scoped function through Symbol.dispose exactly once", () => {
		let disposeCalls = 0;
		const service = Object.assign(() => "ready", {
			[Symbol.dispose](): void {
				disposeCalls++;
			},
		});
		const container = new ContainerBuilder()
			.registerScopedFactory("service", () => service)
			.build();
		const scope = container.startScope();

		expect(scope.get("service")()).toBe("ready");
		scope.dispose();
		scope.dispose();

		expect(disposeCalls).toBe(1);
	});

	it("awaits singleton function cleanup through Symbol.asyncDispose exactly once", async () => {
		let disposeCalls = 0;
		const service = Object.assign(() => "ready", {
			async [Symbol.asyncDispose](): Promise<void> {
				disposeCalls++;
			},
		});
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => service)
			.build();

		container.get("service");
		await container.disposeAsync();
		await container.disposeAsync();

		expect(disposeCalls).toBe(1);
	});

	it("awaits scoped function cleanup through Symbol.asyncDispose exactly once", async () => {
		let disposeCalls = 0;
		const service = Object.assign(() => "ready", {
			async [Symbol.asyncDispose](): Promise<void> {
				disposeCalls++;
			},
		});
		const container = new ContainerBuilder()
			.registerScopedFactory("service", () => service)
			.build();
		const scope = container.startScope();

		scope.get("service");
		await scope.disposeAsync();
		await scope.disposeAsync();

		expect(disposeCalls).toBe(1);
	});

	it("reports async-only function cleanup on the synchronous path", () => {
		let disposeCalls = 0;
		const service = Object.assign(() => "ready", {
			async [Symbol.asyncDispose](): Promise<void> {
				disposeCalls++;
			},
		});
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => service)
			.build();

		container.get("service");

		let error: unknown;
		try {
			container.dispose();
		} catch (cause) {
			error = cause;
		}

		expect(error).toBeInstanceOf(DisposalError);
		expect(error).toMatchObject({
			errors: [
				expect.objectContaining({
					message: expect.stringContaining("Use disposeAsync()"),
				}),
			],
		});
		expect(disposeCalls).toBe(1);
	});

	it("ignores a function without cleanup hooks", async () => {
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => () => "ready")
			.build();

		expect(container.get("service")()).toBe("ready");
		await expect(container.disposeAsync()).resolves.toBeUndefined();
	});
});

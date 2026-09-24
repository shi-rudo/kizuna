import { describe, expect, it, vi } from "vitest";
import {
	ContainerBuilder,
	ContainerDisposedError,
	ServiceResolutionError,
} from "../src";

const captureError = (action: () => unknown): unknown => {
	try {
		action();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
};

describe("a factory that disposes its own container", () => {
	it("cleans up the new singleton value and fails the resolution", () => {
		const cleanup = vi.fn();
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				current.dispose();
				return { dispose: cleanup };
			})
			.build();

		const error = captureError(() => container.get("resource"));

		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect((error as ServiceResolutionError).cause).toBeInstanceOf(
			ContainerDisposedError,
		);
	});

	it("cleans up the new scoped value when the factory disposes its scope", () => {
		const cleanup = vi.fn();
		const container = new ContainerBuilder()
			.registerScopedFactory("resource", (current) => {
				current.dispose();
				return { dispose: cleanup };
			})
			.build();
		const scope = container.startScope();

		const error = captureError(() => scope.get("resource"));

		expect(cleanup).toHaveBeenCalledTimes(1);
		expect((error as ServiceResolutionError).cause).toBeInstanceOf(
			ContainerDisposedError,
		);
	});

	it("keeps a failing cleanup as the cause of the disposal error", () => {
		const cleanupFailure = new Error("cleanup failed");
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				current.dispose();
				return {
					dispose() {
						throw cleanupFailure;
					},
				};
			})
			.build();

		const error = captureError(() => container.get("resource"));
		const disposed = (error as ServiceResolutionError).cause;

		expect(disposed).toBeInstanceOf(ContainerDisposedError);
		expect((disposed as ContainerDisposedError).cause).toBe(cleanupFailure);
	});

	it("starts the cleanup of a Promise value", async () => {
		const cleanup = vi.fn();
		const container = new ContainerBuilder()
			.registerSingletonFactory("resource", (current) => {
				current.dispose();
				return Promise.resolve({ dispose: cleanup });
			})
			.build();

		const error = captureError(() => container.get("resource"));
		await Promise.resolve();
		await Promise.resolve();

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});
});

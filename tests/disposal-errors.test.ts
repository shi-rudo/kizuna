import { describe, expect, it, vi } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";

function captureThrown(action: () => void): unknown {
	try {
		action();
	} catch (error) {
		return error;
	}

	throw new Error("Expected the action to throw");
}

async function captureRejection(action: Promise<void>): Promise<unknown> {
	try {
		await action;
	} catch (error) {
		return error;
	}

	throw new Error("Expected the promise to reject");
}

describe("disposal errors", () => {
	it("attempts every sync cleanup and throws one AggregateError", () => {
		const firstFailure = new Error("first cleanup failed");
		const secondFailure = new Error("second cleanup failed");
		const events: string[] = [];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const container = new ContainerBuilder()
			.registerSingletonFactory("first", () => ({
				dispose(): void {
					events.push("first");
					throw firstFailure;
				},
			}))
			.registerSingletonFactory("good", () => ({
				dispose(): void {
					events.push("good");
				},
			}))
			.registerSingletonFactory("second", () => ({
				dispose(): void {
					events.push("second");
					throw secondFailure;
				},
			}))
			.build();

		container.get("first");
		container.get("good");
		container.get("second");

		const error = captureThrown(() => container.dispose());

		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toEqual([
			firstFailure,
			secondFailure,
		]);
		expect(events).toEqual(["first", "good", "second"]);
		expect(errorSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();
		expect(() => container.get("good")).toThrow(/disposed container/);
		expect(() => container.dispose()).not.toThrow();

		errorSpy.mockRestore();
		warnSpy.mockRestore();
	});

	it("attempts every async cleanup and rejects with one AggregateError", async () => {
		const firstFailure = new Error("first async cleanup failed");
		const secondFailure = new Error("second async cleanup failed");
		const events: string[] = [];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const container = new ContainerBuilder()
			.registerSingletonFactory("first", () => ({
				async dispose(): Promise<void> {
					await Promise.resolve();
					events.push("first");
					throw firstFailure;
				},
			}))
			.registerSingletonFactory("good", () => ({
				async dispose(): Promise<void> {
					await Promise.resolve();
					events.push("good");
				},
			}))
			.registerSingletonFactory("second", () => ({
				async dispose(): Promise<void> {
					await Promise.resolve();
					events.push("second");
					throw secondFailure;
				},
			}))
			.build();

		container.get("first");
		container.get("good");
		container.get("second");

		const error = await captureRejection(container.disposeAsync());

		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toEqual([
			firstFailure,
			secondFailure,
		]);
		expect(events).toEqual(expect.arrayContaining(["first", "good", "second"]));
		expect(errorSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();
		expect(() => container.get("good")).toThrow(/disposed container/);
		await expect(container.disposeAsync()).resolves.toBeUndefined();

		errorSpy.mockRestore();
		warnSpy.mockRestore();
	});

	it("cleans up a dependency after its consumer cleanup rejects", async () => {
		const failure = new Error("consumer cleanup failed");
		const events: string[] = [];

		class Dependency {
			async dispose(): Promise<void> {
				events.push("dependency");
			}
		}

		class Consumer {
			constructor(readonly dependency: Dependency) {}

			async dispose(): Promise<void> {
				events.push("consumer");
				throw failure;
			}
		}

		const container = new ContainerBuilder()
			.registerSingleton("dependency", Dependency)
			.registerSingleton("consumer", Consumer, "dependency")
			.build();

		container.get("consumer");
		const error = await captureRejection(container.disposeAsync());

		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toEqual([failure]);
		expect(events).toEqual(["consumer", "dependency"]);
	});

	it("reports Promise-based cleanup when dispose() cannot await it", async () => {
		let finishCleanup!: () => void;
		const cleanupFinished = new Promise<void>((resolve) => {
			finishCleanup = resolve;
		});

		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => ({
				dispose(): Promise<void> {
					return cleanupFinished;
				},
			}))
			.build();

		container.get("service");
		const error = captureThrown(() => container.dispose());

		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toHaveLength(1);
		expect((error as AggregateError).errors[0]).toBeInstanceOf(TypeError);
		expect((error as AggregateError).errors[0]).toHaveProperty(
			"message",
			expect.stringMatching(/disposeAsync\(\)/),
		);

		finishCleanup();
		await cleanupFinished;
	});

	it("propagates disposal errors through the resource management symbols", async () => {
		const syncContainer = new ContainerBuilder()
			.registerSingletonFactory("service", () => ({
				dispose(): void {
					throw new Error("sync symbol failure");
				},
			}))
			.build();
		syncContainer.get("service");

		expect(() => syncContainer[Symbol.dispose]()).toThrow(AggregateError);

		const asyncContainer = new ContainerBuilder()
			.registerSingletonFactory("service", () => ({
				async dispose(): Promise<void> {
					throw new Error("async symbol failure");
				},
			}))
			.build();
		asyncContainer.get("service");

		await expect(asyncContainer[Symbol.asyncDispose]()).rejects.toBeInstanceOf(
			AggregateError,
		);
	});
});

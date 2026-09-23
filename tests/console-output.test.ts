import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";

const consoleMethods = ["debug", "error", "info", "log", "warn"] as const;

describe("console output", () => {
	let spies: ReturnType<typeof vi.spyOn>[];

	beforeEach(() => {
		spies = consoleMethods.map((method) =>
			vi.spyOn(console, method).mockImplementation(() => {}),
		);
	});

	afterEach(() => {
		for (const spy of spies) {
			spy.mockRestore();
		}
	});

	const expectNoConsoleOutput = (): void => {
		for (const spy of spies) {
			expect(spy).not.toHaveBeenCalled();
		}
	};

	it("does not write to the console when an empty builder builds", () => {
		const container = new ContainerBuilder().build();

		expect(container).toBeDefined();
		expectNoConsoleOutput();
	});

	it("does not write to the console during registration, resolution, and disposal", () => {
		class Logger {}
		const container = new ContainerBuilder()
			.registerSingleton("Logger", Logger)
			.registerScopedFactory("RequestId", () => "request-1")
			.build();

		container.get("Logger");
		const scope = container.startScope();
		scope.get("RequestId");
		scope.dispose();
		container.dispose();

		expectNoConsoleOutput();
	});
});

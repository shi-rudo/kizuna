import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src/api/container-builder";

describe("dependency-aware disposal order", () => {
	it("disposes a consumer before its dependency", () => {
		const events: string[] = [];

		class Dependency {
			dispose(): void {
				events.push("dependency");
			}
		}

		class Consumer {
			constructor(readonly dependency: Dependency) {}

			dispose(): void {
				events.push("consumer");
			}
		}

		const container = new ContainerBuilder()
			.registerSingleton("dependency", Dependency)
			.registerSingleton("consumer", Consumer, "dependency")
			.build();

		container.get("consumer");
		container.dispose();

		expect(events).toEqual(["consumer", "dependency"]);
	});

	it("waits for async consumers before starting dependency cleanup", async () => {
		const events: string[] = [];
		let finishConsumer!: () => void;
		const consumerGate = new Promise<void>((resolve) => {
			finishConsumer = resolve;
		});

		class Dependency {
			async dispose(): Promise<void> {
				events.push("dependency:start");
			}
		}

		class Consumer {
			constructor(readonly dependency: Dependency) {}

			async dispose(): Promise<void> {
				events.push("consumer:start");
				await consumerGate;
				events.push("consumer:end");
			}
		}

		const container = new ContainerBuilder()
			.registerSingleton("dependency", Dependency)
			.registerSingleton("consumer", Consumer, "dependency")
			.build();

		container.get("consumer");
		const disposal = container.disposeAsync();

		await Promise.resolve();
		expect(events).toEqual(["consumer:start"]);

		finishConsumer();
		await disposal;

		expect(events).toEqual([
			"consumer:start",
			"consumer:end",
			"dependency:start",
		]);
	});

	it("waits for every async consumer of one dependency", async () => {
		const events: string[] = [];
		let finishFirst!: () => void;
		let finishSecond!: () => void;
		const firstGate = new Promise<void>((resolve) => {
			finishFirst = resolve;
		});
		const secondGate = new Promise<void>((resolve) => {
			finishSecond = resolve;
		});

		class Dependency {
			async dispose(): Promise<void> {
				events.push("dependency");
			}
		}

		class FirstConsumer {
			constructor(readonly dependency: Dependency) {}

			async dispose(): Promise<void> {
				events.push("first:start");
				await firstGate;
				events.push("first:end");
			}
		}

		class SecondConsumer {
			constructor(readonly dependency: Dependency) {}

			async dispose(): Promise<void> {
				events.push("second:start");
				await secondGate;
				events.push("second:end");
			}
		}

		const container = new ContainerBuilder()
			.registerSingleton("dependency", Dependency)
			.registerSingleton("first", FirstConsumer, "dependency")
			.registerSingleton("second", SecondConsumer, "dependency")
			.build();

		container.get("first");
		container.get("second");
		const disposal = container.disposeAsync();

		await Promise.resolve();
		expect(events).toEqual(["first:start", "second:start"]);

		finishFirst();
		await Promise.resolve();
		expect(events).not.toContain("dependency");

		finishSecond();
		await disposal;
		expect(events).toEqual([
			"first:start",
			"second:start",
			"first:end",
			"second:end",
			"dependency",
		]);
	});

	it("does not delay a dependency for unrelated async cleanup", async () => {
		const events: string[] = [];
		let finishUnrelated!: () => void;
		const unrelatedGate = new Promise<void>((resolve) => {
			finishUnrelated = resolve;
		});

		class Dependency {
			async dispose(): Promise<void> {
				events.push("dependency");
			}
		}

		class Consumer {
			constructor(readonly dependency: Dependency) {}

			async dispose(): Promise<void> {
				events.push("consumer");
			}
		}

		class Unrelated {
			async dispose(): Promise<void> {
				events.push("unrelated:start");
				await unrelatedGate;
				events.push("unrelated:end");
			}
		}

		const container = new ContainerBuilder()
			.registerSingleton("dependency", Dependency)
			.registerSingleton("consumer", Consumer, "dependency")
			.registerSingleton("unrelated", Unrelated)
			.build();

		container.get("consumer");
		container.get("unrelated");
		const disposal = container.disposeAsync();

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(events).toContain("dependency");
		expect(events).not.toContain("unrelated:end");

		finishUnrelated();
		await disposal;
	});

	it("includes consumers from multi-registrations in the disposal graph", () => {
		const events: string[] = [];

		class Dependency {
			dispose(): void {
				events.push("dependency");
			}
		}

		class Consumer {
			constructor(readonly dependency: Dependency) {}

			dispose(): void {
				events.push("consumer");
			}
		}

		const container = new ContainerBuilder()
			.registerSingleton("dependency", Dependency)
			.addSingleton("consumers", Consumer, "dependency")
			.build();

		container.getAll("consumers");
		container.dispose();

		expect(events).toEqual(["consumer", "dependency"]);
	});

	it("disposes every service behind a multi-registration dependency after its consumer", () => {
		const events: string[] = [];

		class FirstDependency {
			dispose(): void {
				events.push("first-dependency");
			}
		}

		class SecondDependency {
			dispose(): void {
				events.push("second-dependency");
			}
		}

		class Consumer {
			constructor(readonly dependencies: readonly unknown[]) {}

			dispose(): void {
				events.push("consumer");
			}
		}

		const container = new ContainerBuilder()
			.addSingleton("dependencies", FirstDependency)
			.addSingleton("dependencies", SecondDependency)
			.registerSingleton("consumer", Consumer, "dependencies")
			.build();

		container.get("consumer");
		container.dispose();

		expect(events).toEqual([
			"consumer",
			"first-dependency",
			"second-dependency",
		]);
	});

	it("uses registration order for unrelated services", () => {
		const events: string[] = [];

		class First {
			dispose(): void {
				events.push("first");
			}
		}

		class Second {
			dispose(): void {
				events.push("second");
			}
		}

		class Third {
			dispose(): void {
				events.push("third");
			}
		}

		const container = new ContainerBuilder()
			.addSingleton("first-services", First)
			.registerSingleton("second", Second)
			.addSingleton("third-services", Third)
			.build();

		container.getAll("first-services");
		container.get("second");
		container.getAll("third-services");
		container.dispose();

		expect(events).toEqual(["first", "second", "third"]);
	});

	it("preserves dependency order in a child scope", () => {
		const events: string[] = [];

		class Dependency {
			dispose(): void {
				events.push("dependency");
			}
		}

		class Consumer {
			constructor(readonly dependency: Dependency) {}

			dispose(): void {
				events.push("consumer");
			}
		}

		const container = new ContainerBuilder()
			.registerScoped("dependency", Dependency)
			.registerScoped("consumer", Consumer, "dependency")
			.build();
		const scope = container.startScope();

		scope.get("consumer");
		scope.dispose();

		expect(events).toEqual(["consumer", "dependency"]);
	});

	it("does not hang when registration metadata contains a cycle", () => {
		class First {
			constructor(readonly second: unknown) {}
		}

		class Second {
			constructor(readonly first: unknown) {}
		}

		const container = new ContainerBuilder()
			.registerSingleton("first", First, "second")
			.registerSingleton("second", Second, "first")
			.build();

		expect(() => container.dispose()).not.toThrow();
	});

	it("does not hang during async disposal of cyclic metadata", async () => {
		class First {
			constructor(readonly second: unknown) {}
		}

		class Second {
			constructor(readonly first: unknown) {}
		}

		const container = new ContainerBuilder()
			.registerSingleton("first", First, "second")
			.registerSingleton("second", Second, "first")
			.build();

		await expect(container.disposeAsync()).resolves.toBeUndefined();
	});

	it("keeps dependency-aware disposal idempotent", async () => {
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
			}
		}

		const container = new ContainerBuilder()
			.registerSingleton("dependency", Dependency)
			.registerSingleton("consumer", Consumer, "dependency")
			.build();

		container.get("consumer");
		await container.disposeAsync();
		await container.disposeAsync();

		expect(events).toEqual(["consumer", "dependency"]);
	});
});

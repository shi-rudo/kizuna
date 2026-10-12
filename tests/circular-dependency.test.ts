import { describe, expect, it } from "vitest";
import { CircularDependencyError } from "../src/api/container";
import { ContainerBuilder } from "../src/api/container-builder";

class A {
	constructor(public b: unknown) {}
}
class B {
	constructor(public a: unknown) {}
}
class C {
	constructor(public b: unknown) {}
}

describe("Circular dependency detection at resolve time", () => {
	it("throws a CircularDependencyError with the dependency chain instead of overflowing the stack", () => {
		const container = new ContainerBuilder()
			.registerSingleton("a", A, "b")
			.registerSingleton("b", B, "a")
			.build({ validation: "deferred" });

		expect(() => container.get("a")).toThrowError(CircularDependencyError);

		try {
			container.get("a");
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(CircularDependencyError);
			expect((error as Error).message).toBe(
				"Circular dependency detected: a -> b -> a",
			);
		}
	});

	it("detects a direct self-dependency", () => {
		const container = new ContainerBuilder()
			.registerSingleton("a", A, "a")
			.build({ validation: "deferred" });

		expect(() => container.get("a")).toThrowError(
			"Circular dependency detected: a -> a",
		);
	});

	it("detects cycles introduced through factories resolving eagerly", () => {
		const container = new ContainerBuilder()
			.registerSingletonFactory("x", (p) => p.get("y" as never))
			.registerSingletonFactory("y", (p) => p.get("x" as never))
			.build();

		expect(() => container.get("x")).toThrowError(CircularDependencyError);
	});

	it("leaves the container usable after a cycle error (resolution stack is unwound)", () => {
		class Standalone {}
		const container = new ContainerBuilder()
			.registerSingleton("a", A, "b")
			.registerSingleton("b", B, "a")
			.registerSingleton("ok", Standalone)
			.build({ validation: "deferred" });

		expect(() => container.get("a")).toThrowError(CircularDependencyError);
		// Same clean error on retry — no stale stack entries
		expect(() => container.get("a")).toThrowError(
			"Circular dependency detected: a -> b -> a",
		);
		expect(container.get("ok")).toBeInstanceOf(Standalone);
	});

	it('does not wrap the cycle error in nested "Failed to resolve" messages', () => {
		const container = new ContainerBuilder()
			.registerSingleton("a", A, "b")
			.registerSingleton("b", B, "a")
			.build({ validation: "deferred" });

		try {
			container.get("a");
			expect.unreachable("should have thrown");
		} catch (error) {
			expect((error as Error).message).not.toContain("Failed to resolve");
			expect((error as Error).message.length).toBeLessThan(200);
		}
	});
});

describe("Circular dependency detection in deep resolution chains", () => {
	interface UntypedBuilder {
		registerTransientFactory(
			key: string,
			factory: (container: { get(key: string): unknown }) => unknown,
		): UntypedBuilder;
		build(options: { validation: "deferred" }): { get(key: string): unknown };
	}

	// Registers node-0 -> node-1 -> ... -> node-(depth - 1). The last node
	// resolves `lastDependency` when one is given.
	const chain = (
		depth: number,
		lastDependency?: string,
		builder = new ContainerBuilder() as unknown as UntypedBuilder,
	): UntypedBuilder => {
		let current = builder;
		for (let index = 0; index < depth; index++) {
			const next = index + 1 < depth ? `node-${index + 1}` : lastDependency;
			current = current.registerTransientFactory(`node-${index}`, (c) => ({
				next: next === undefined ? undefined : c.get(next),
			}));
		}
		return current;
	};

	it("detects a cycle deeper than 16 levels with the full chain", () => {
		const container = chain(20, "node-0").build({ validation: "deferred" });

		const error = (() => {
			try {
				container.get("node-0");
			} catch (caught) {
				return caught;
			}
		})();

		expect(error).toBeInstanceOf(CircularDependencyError);
		expect((error as CircularDependencyError).chain).toEqual([
			...Array.from({ length: 20 }, (_, index) => `node-${index}`),
			"node-0",
		]);
	});

	it("resolves a shared dependency twice deeper than 16 levels without a false cycle", () => {
		const container = chain(20, "fork")
			.registerTransientFactory("fork", (c) => [c.get("leaf"), c.get("leaf")])
			.registerTransientFactory("leaf", () => ({}))
			.build({ validation: "deferred" });

		expect(() => container.get("node-0")).not.toThrow();
	});

	it("detects a shallow cycle after a deep resolution", () => {
		const container = chain(20)
			.registerTransientFactory("a", (c) => c.get("b"))
			.registerTransientFactory("b", (c) => c.get("a"))
			.build({ validation: "deferred" });
		container.get("node-0");

		expect(() => container.get("a")).toThrowError(CircularDependencyError);
	});
});

describe("Circular dependency detection in validate()", () => {
	it("reports a real cycle exactly once and no phantom cycles for dependents of cycle members", () => {
		const builder = new ContainerBuilder()
			.registerSingleton("a", A, "b")
			.registerSingleton("b", B, "a")
			.registerSingleton("c", C, "b");

		const cycleIssues = builder
			.validate()
			.filter((issue) => issue.code === "CIRCULAR_DEPENDENCY");

		expect(cycleIssues).toHaveLength(1);
		expect(cycleIssues[0]?.path).toEqual(["a", "b", "a"]);
	});

	it("reports two independent cycles separately", () => {
		class D {
			constructor(public c: unknown) {}
		}
		class C2 {
			constructor(public d: unknown) {}
		}
		const builder = new ContainerBuilder()
			.registerSingleton("a", A, "b")
			.registerSingleton("b", B, "a")
			.registerSingleton("c", C2, "d")
			.registerSingleton("d", D, "c");

		const cycleIssues = builder
			.validate()
			.filter((issue) => issue.code === "CIRCULAR_DEPENDENCY");

		expect(cycleIssues).toHaveLength(2);
	});

	it("reports no cycles for an acyclic graph", () => {
		class Leaf {}
		const builder = new ContainerBuilder()
			.registerSingleton("leaf", Leaf)
			.registerSingleton("c", C, "leaf");

		const cycleIssues = builder
			.validate()
			.filter((issue) => issue.code === "CIRCULAR_DEPENDENCY");

		expect(cycleIssues).toHaveLength(0);
	});
});

import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src";

describe("runtime boundary validation", () => {
	it("rejects a non-string getAll key", () => {
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => 42)
			.build();

		expect(() => container.getAll(Symbol("service") as never)).toThrow(
			TypeError,
		);
	});

	it("rejects an unknown graph validation mode", () => {
		expect(() =>
			new ContainerBuilder().build({ validation: "disabled" as never }),
		).toThrow(TypeError);
	});
});

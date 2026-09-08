import { describe, expect, it } from "vitest";
import { ContainerBuilder, ServiceProviderToken } from "../src";

describe("factory resolution context", () => {
	it("exposes resolution operations without container lifecycle operations", () => {
		let receivedContext: unknown;
		const container = new ContainerBuilder()
			.registerSingletonFactory("dependency", () => ({ value: 42 }))
			.registerSingletonFactory("service", (resolver) => {
				receivedContext = resolver;
				return resolver.get("dependency");
			})
			.build();

		expect(container.get("service")).toEqual({ value: 42 });
		expect(receivedContext).toMatchObject({
			get: expect.any(Function),
			getAll: expect.any(Function),
		});
		expect(receivedContext).not.toHaveProperty("dispose");
		expect(receivedContext).not.toHaveProperty("disposeAsync");
		expect(receivedContext).not.toHaveProperty("startScope");
		expect(() =>
			(
				receivedContext as {
					get(key: unknown): unknown;
				}
			).get(ServiceProviderToken),
		).toThrow(TypeError);
	});
});

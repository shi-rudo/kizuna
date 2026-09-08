import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src";

describe("service value ownership", () => {
	it("cleans owned values and leaves transient values to the caller", async () => {
		const cleanupCalls = {
			singleton: 0,
			rootScoped: 0,
			childScoped: 0,
			transient: 0,
		};
		let scopedInstance = 0;
		const container = new ContainerBuilder()
			.registerSingletonFactory("singleton", () => ({
				async [Symbol.asyncDispose]() {
					cleanupCalls.singleton++;
				},
			}))
			.registerScopedFactory("scoped", () => {
				const instance = scopedInstance++;
				return {
					async [Symbol.asyncDispose]() {
						if (instance === 0) {
							cleanupCalls.rootScoped++;
						} else {
							cleanupCalls.childScoped++;
						}
					},
				};
			})
			.registerTransientFactory("transient", () => ({
				async [Symbol.asyncDispose]() {
					cleanupCalls.transient++;
				},
			}))
			.build();

		container.get("singleton");
		container.get("scoped");
		container.get("transient");
		container.get("transient");
		const scope = container.startScope();
		expect(scope.get("singleton")).toBe(container.get("singleton"));
		scope.get("scoped");
		scope.get("transient");

		await scope.disposeAsync();
		expect(cleanupCalls).toEqual({
			singleton: 0,
			rootScoped: 0,
			childScoped: 1,
			transient: 0,
		});

		await container.disposeAsync();
		expect(cleanupCalls).toEqual({
			singleton: 1,
			rootScoped: 1,
			childScoped: 1,
			transient: 0,
		});
	});
});

import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../src";

describe("rejected async factory retries", () => {
	it("returns a rejecting observer Promise for a singleton factory", async () => {
		const failure = new Error("singleton initialization failed");
		const factoryPromise = Promise.reject(failure);
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => factoryPromise)
			.build();

		const servicePromise = container.get("service");
		const rejection = expect(servicePromise).rejects.toBe(failure);

		expect(servicePromise).not.toBe(factoryPromise);
		await rejection;
	});

	it("keeps a singleton service with a throwing then getter", () => {
		// biome-ignore lint/suspicious/noThenProperty: This reproduces a hostile Promise-like value.
		const service = Object.defineProperty({}, "then", {
			get: () => {
				throw new Error("not a Promise");
			},
		});
		let attempts = 0;
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => {
				attempts++;
				return service;
			})
			.build();

		expect(container.get("service")).toBe(service);
		expect(container.get("service")).toBe(service);
		expect(attempts).toBe(1);
	});

	it("reads a Promise-like then getter once", async () => {
		let thenReads = 0;
		// biome-ignore lint/suspicious/noThenProperty: This verifies one-shot thenable assimilation.
		const factoryValue = Object.defineProperty({}, "then", {
			get: () => {
				thenReads++;
				return thenReads === 1
					? (resolve: (value: string) => void) => resolve("ready")
					: undefined;
			},
		}) as PromiseLike<string>;
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => factoryValue)
			.build();

		await expect(container.get("service")).resolves.toBe("ready");
		expect(thenReads).toBe(1);
	});

	it("retries a rejected singleton factory Promise", async () => {
		const failure = new Error("singleton initialization failed");
		const failedPromise = Promise.reject(failure);
		const recoveredPromise = Promise.resolve({ state: "ready" });
		let attempts = 0;
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => {
				attempts++;
				return attempts === 1 ? failedPromise : recoveredPromise;
			})
			.build();

		const first = container.get("service");
		await expect(first).rejects.toBe(failure);

		const second = container.get("service");
		expect(second).not.toBe(recoveredPromise);
		await expect(second).resolves.toEqual({ state: "ready" });
		expect(container.get("service")).toBe(second);
		expect(attempts).toBe(2);
	});

	it("retries a rejected factory Promise in the same consumer catch", async () => {
		const failure = new Error("temporary failure");
		let attempts = 0;
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => {
				attempts++;
				return attempts === 1
					? Promise.reject(failure)
					: Promise.resolve("ready");
			})
			.build();

		const recovered = container
			.get("service")
			.catch(() => container.get("service"));

		await expect(recovered).resolves.toBe("ready");
		expect(attempts).toBe(2);
	});

	it("retries a rejected scoped factory Promise in only that scope", async () => {
		const scopeAttempts = new Map<string, number>();
		const container = new ContainerBuilder()
			.registerScopedFactory("scopeId", () => crypto.randomUUID())
			.registerScopedFactory("service", (provider) => {
				const scopeId = provider.get("scopeId");
				const attempts = (scopeAttempts.get(scopeId) ?? 0) + 1;
				scopeAttempts.set(scopeId, attempts);
				return attempts === 1
					? Promise.reject(new Error(`${scopeId} failed`))
					: Promise.resolve(`${scopeId} ready`);
			})
			.build();
		const firstScope = container.startScope();
		const secondScope = container.startScope();

		const firstScopeId = firstScope.get("scopeId");
		const secondScopeId = secondScope.get("scopeId");
		await expect(firstScope.get("service")).rejects.toThrow(
			`${firstScopeId} failed`,
		);
		await expect(secondScope.get("service")).rejects.toThrow(
			`${secondScopeId} failed`,
		);

		await expect(firstScope.get("service")).resolves.toBe(
			`${firstScopeId} ready`,
		);
		expect(scopeAttempts.get(firstScopeId)).toBe(2);
		expect(scopeAttempts.get(secondScopeId)).toBe(1);
	});

	it("shares one Promise while the factory result is pending", async () => {
		const factoryResult = createDeferred<string>();
		let attempts = 0;
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => {
				attempts++;
				return factoryResult.promise;
			})
			.build();

		const first = container.get("service");
		const second = container.get("service");
		expect(second).toBe(first);
		expect(attempts).toBe(1);

		factoryResult.resolve("ready");
		await expect(first).resolves.toBe("ready");
	});

	it("keeps a fulfilled factory Promise cached", async () => {
		const factoryResult = Promise.resolve("ready");
		let attempts = 0;
		const container = new ContainerBuilder()
			.registerSingletonFactory("service", () => {
				attempts++;
				return factoryResult;
			})
			.build();

		const first = container.get("service");
		await expect(first).resolves.toBe("ready");

		expect(container.get("service")).toBe(first);
		expect(attempts).toBe(1);
	});

	it("retries only the rejected entry in a singleton multi-registration", async () => {
		const failure = new Error("first entry failed");
		const failedPromise = Promise.reject(failure);
		const recoveredPromise = Promise.resolve("recovered");
		const stablePromise = Promise.resolve("stable");
		let failedEntryAttempts = 0;
		let stableEntryAttempts = 0;
		const container = new ContainerBuilder()
			.addSingletonFactory("services", () => {
				failedEntryAttempts++;
				return failedEntryAttempts === 1 ? failedPromise : recoveredPromise;
			})
			.addSingletonFactory("services", () => {
				stableEntryAttempts++;
				return stablePromise;
			})
			.build();

		const first = container.getAll("services");
		await expect(first[0]).rejects.toBe(failure);
		await expect(first[1]).resolves.toBe("stable");

		const second = container.getAll("services");
		expect(second[0]).not.toBe(recoveredPromise);
		expect(second[1]).toBe(first[1]);
		expect(second[1]).not.toBe(stablePromise);
		expect(failedEntryAttempts).toBe(2);
		expect(stableEntryAttempts).toBe(1);
	});
});

function createDeferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
} {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
}

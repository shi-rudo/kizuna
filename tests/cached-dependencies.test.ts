import { describe, expect, it } from "vitest";
import {
	ContainerBuilder,
	ContainerDisposedError,
	ServiceResolutionError,
} from "../src";

class Connection {
	static created = 0;
	constructor() {
		Connection.created++;
	}
}

class Repository {
	static created = 0;
	constructor(readonly connection: object) {
		Repository.created++;
	}
}

class Service {
	constructor(readonly repository: Repository) {}
}

const captureError = (action: () => unknown): unknown => {
	try {
		action();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
};

const resetCounters = (): void => {
	Connection.created = 0;
	Repository.created = 0;
};

describe("dependencies of a cached service", () => {
	it("are resolved only when the singleton creates its value", () => {
		resetCounters();
		const container = new ContainerBuilder()
			.registerTransient("connection", Connection)
			.registerSingleton("repository", Repository, "connection")
			.build();
		container.get("repository");
		container.get("repository");

		container.get("repository");

		expect(Connection.created).toBe(1);
	});

	it("are resolved only when the scoped service creates its value in a scope", () => {
		resetCounters();
		const container = new ContainerBuilder()
			.registerTransient("connection", Connection)
			.registerScoped("repository", Repository, "connection")
			.build();
		const scope = container.startScope();
		scope.get("repository");

		scope.get("repository");

		expect(Connection.created).toBe(1);
	});

	it("are not resolved once the owning container started its disposal", async () => {
		resetCounters();
		const container = new ContainerBuilder()
			.registerTransient("connection", Connection)
			.registerSingleton("repository", Repository, "connection")
			.build();
		const scope = container.startScope();
		const pending = container.disposeAsync();

		const error = captureError(() => scope.get("repository"));
		await pending;

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(Connection.created).toBe(0);
	});

	it("do not create the service when a dependency disposes the container", () => {
		resetCounters();
		const container = new ContainerBuilder()
			.registerTransientFactory("connection", (current) => {
				current.dispose();
				return new Connection();
			})
			.registerSingleton("repository", Repository, "connection")
			.build();

		const error = captureError(() => container.get("repository"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(Repository.created).toBe(0);
	});

	it("do not create a transient service when a dependency disposes the container", () => {
		resetCounters();
		const container = new ContainerBuilder()
			.registerTransientFactory("connection", (current) => {
				current.dispose();
				return new Connection();
			})
			.registerTransient("repository", Repository, "connection")
			.build();

		const error = captureError(() => container.get("repository"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(Repository.created).toBe(0);
	});

	it("do not create a transient service when a dependency starts disposeAsync() of the container", async () => {
		resetCounters();
		let pending: Promise<void> | undefined;
		const container = new ContainerBuilder()
			.registerTransientFactory("connection", (current) => {
				pending = current.disposeAsync();
				return new Connection();
			})
			.registerTransient("repository", Repository, "connection")
			.registerSingleton("service", Service, "repository")
			.build();

		const error = captureError(() => container.get("repository"));
		await pending;

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(Repository.created).toBe(0);
	});

	it("do not create a second value when a dependency resolves the same singleton through another container", () => {
		resetCounters();
		let nested = false;
		const root = new ContainerBuilder()
			.registerTransientFactory("connection", () => {
				if (!nested) {
					nested = true;
					root.get("repository");
				}
				return new Connection();
			})
			.registerSingleton("repository", Repository, "connection")
			.build();
		const scope = root.startScope();

		scope.get("repository");

		expect(Repository.created).toBe(1);
	});
});

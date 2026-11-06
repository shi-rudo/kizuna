import { describe, expect, it } from "vitest";
import {
	ContainerBuilder,
	ContainerDisposedError,
	ServiceResolutionError,
} from "../src";

class Connection {
	closed = false;

	[Symbol.dispose](): void {
		this.closed = true;
	}
}

class Repository {
	constructor(
		readonly connection: Connection,
		readonly settings: unknown,
	) {}
}

const captureError = (action: () => unknown): unknown => {
	try {
		action();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
};

const failingFactory = (): never => {
	throw new Error("settings unavailable");
};

describe("a failed resolution does not clean up transient values", () => {
	it("leaves the value of an earlier transient getAll() entry to nobody", () => {
		const connections: Connection[] = [];
		const container = new ContainerBuilder()
			.addTransientFactory("handlers", () => {
				const connection = new Connection();
				connections.push(connection);
				return connection;
			})
			.addTransientFactory("handlers", failingFactory)
			.build();

		const error = captureError(() => container.getAll("handlers"));
		container.dispose();

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(connections).toHaveLength(1);
		expect(connections[0]?.closed).toBe(false);
	});

	it("keeps a shared value that an earlier transient getAll() entry returned", () => {
		const container = new ContainerBuilder()
			.registerSingleton("connection", Connection)
			.addTransientFactory("handlers", (current) => current.get("connection"))
			.addTransientFactory("handlers", failingFactory)
			.build();

		captureError(() => container.getAll("handlers"));
		const connection = container.get("connection");

		expect(connection.closed).toBe(false);
		container.dispose();
		expect(connection.closed).toBe(true);
	});

	it("leaves an earlier transient constructor dependency to nobody", () => {
		const connections: Connection[] = [];
		const container = new ContainerBuilder()
			.registerTransientFactory("connection", () => {
				const connection = new Connection();
				connections.push(connection);
				return connection;
			})
			.registerSingletonFactory("settings", failingFactory)
			.registerSingleton("repository", Repository, "connection", "settings")
			.build();

		const error = captureError(() => container.get("repository"));
		container.dispose();

		expect(error).toBeInstanceOf(ServiceResolutionError);
		expect(connections).toHaveLength(1);
		expect(connections[0]?.closed).toBe(false);
	});

	it("leaves a transient constructor dependency to nobody when the container closes during the resolution", () => {
		const connections: Connection[] = [];
		const container = new ContainerBuilder()
			.registerTransientFactory("connection", () => {
				const connection = new Connection();
				connections.push(connection);
				return connection;
			})
			.registerTransientFactory("settings", (current) => {
				current.dispose();
				return {};
			})
			.registerSingleton("repository", Repository, "connection", "settings")
			.build();

		const error = captureError(() => container.get("repository"));

		expect(error).toBeInstanceOf(ContainerDisposedError);
		expect(connections).toHaveLength(1);
		expect(connections[0]?.closed).toBe(false);
	});
});

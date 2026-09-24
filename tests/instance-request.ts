import type { InstanceRequest } from "../src/core/contracts";

/** Builds a lifecycle request with fixed factory arguments. */
export const requestWith = (...args: unknown[]): InstanceRequest => ({
	factoryArguments: () => args,
	valueCreated: () => undefined,
});

/** A lifecycle request without factory arguments. */
export const noArguments: InstanceRequest = requestWith();

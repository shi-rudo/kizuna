import type { InstanceSource } from "../src/core/contracts";

/** Builds a lifecycle source with fixed factory arguments. It needs no resolver. */
export const requestWith = (...args: unknown[]): InstanceSource<void> => ({
	factoryArguments: () => args,
	valueCreated: () => undefined,
});

/** A lifecycle source without factory arguments. */
export const noArguments: InstanceSource<void> = requestWith();

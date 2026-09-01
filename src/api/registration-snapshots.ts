import type { ServiceLifetime } from "../core/contracts.js";
import type { ServiceWrapper } from "../core/services/service-wrapper.js";

/** Immutable graph input for one service registration. */
export interface RegistrationSnapshot {
	readonly dependencies: readonly string[];
	readonly disposed: boolean;
	readonly key: string;
	readonly lifetime: ServiceLifetime;
	readonly registrationIndex?: number;
}

/** Creates immutable graph input from mutable registration wrappers. */
export const createRegistrationSnapshots = (
	registrations: ReadonlyMap<string, ServiceWrapper>,
	multiRegistrations: ReadonlyMap<string, readonly ServiceWrapper[]>,
): readonly RegistrationSnapshot[] => {
	const snapshots: RegistrationSnapshot[] = [];
	const addSnapshot = (
		key: string,
		resolver: ServiceWrapper,
		registrationIndex?: number,
	): void => {
		snapshots.push(
			Object.freeze({
				dependencies: Object.freeze([...resolver.getDependencies()]),
				disposed: resolver.isDisposed(),
				key,
				lifetime: resolver.getLifetime(),
				...(registrationIndex === undefined ? {} : { registrationIndex }),
			}),
		);
	};

	registrations.forEach((resolver, key) => {
		addSnapshot(key, resolver);
	});
	multiRegistrations.forEach((resolvers, key) => {
		resolvers.forEach((resolver, registrationIndex) => {
			addSnapshot(key, resolver, registrationIndex);
		});
	});

	return Object.freeze(snapshots);
};

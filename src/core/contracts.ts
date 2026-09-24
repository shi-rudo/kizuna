import type { ServiceWrapper } from "./services/service-wrapper.js";

/** Lifetime classification of a service lifecycle. */
export type ServiceLifetime = "singleton" | "scoped" | "transient";

/** Describes whether a lifecycle owns, borrows, or does not track service values. */
export type ServiceValueOwnership = "owned" | "borrowed" | "untracked";

/** A restricted reference to one singleton that another container owns. */
export interface BorrowedSingletonReference {
	resolve(): unknown;
}

/** The disposal path that closes a container: `dispose()` or `disposeAsync()`. */
export type DisposalMode = "sync" | "async";

/**
 * Takes over the asynchronous cleanup of a value that a factory returned after
 * its lifecycle closed. `disposeAsync()` waits for the cleanup.
 */
export type AdoptLateCleanup = (cleanup: Promise<void>) => void;

/** Internal runtime contract for service lifecycles. */
export interface ServiceLifecycle {
	readonly lifetime: ServiceLifetime;
	readonly valueOwnership: ServiceValueOwnership;
	getInstance<T>(...args: any): T;
	createScope(): ServiceLifecycle;
	/**
	 * Stops new resolutions before the owning container starts its cleanup.
	 * Lifecycles without owned values do not need it.
	 */
	close?(mode: DisposalMode, adopt: AdoptLateCleanup): void;
	dispose(): void;
	disposeAsync(): Promise<void>;
}

/** Internal lifecycle contract for registrations that receive a factory. */
export interface ConfigurableServiceLifecycle extends ServiceLifecycle {
	setFactory(factory: (...args: any) => any): void;
}

/** Internal contract for components that assemble a service wrapper. */
export interface ServiceBuilder {
	build(lifecycle: ConfigurableServiceLifecycle): ServiceWrapper;
}

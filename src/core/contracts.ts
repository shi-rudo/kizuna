import type { ServiceWrapper } from "./services/service-wrapper.js";

/** Lifetime classification of a service lifecycle. */
export type ServiceLifetime = "singleton" | "scoped" | "transient";

/** Describes whether a lifecycle owns, borrows, or does not track service values. */
export type ServiceValueOwnership = "owned" | "borrowed" | "untracked";

/** A restricted reference to one singleton that another container owns. */
export interface BorrowedSingletonReference {
	resolve(): unknown;
}

/**
 * Takes over the asynchronous cleanup of a value that a factory returned after
 * its lifecycle closed. `disposeAsync()` passes it and waits for the cleanup.
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
	 * `disposeAsync()` passes `adopt`; `dispose()` does not.
	 */
	close?(adopt?: AdoptLateCleanup): void;
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

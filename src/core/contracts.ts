import type { ServiceWrapper } from "./services/service-wrapper.js";

/** Lifetime classification of a service lifecycle. */
export type ServiceLifetime = "singleton" | "scoped" | "transient";

/** Describes whether a lifecycle owns, borrows, or does not track service values. */
export type ServiceValueOwnership = "owned" | "borrowed" | "untracked";

/** A restricted reference to one singleton that another container owns. */
export interface BorrowedSingletonReference {
	resolve(): unknown;
}

/** Internal runtime contract for service lifecycles. */
export interface ServiceLifecycle {
	readonly lifetime: ServiceLifetime;
	readonly valueOwnership: ServiceValueOwnership;
	getInstance<T>(...args: any): T;
	createScope(): ServiceLifecycle;
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

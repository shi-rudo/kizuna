import type { UnawaitedFailureSink } from "./services/async-dispose.js";
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
 * Resolves the arguments of a factory call. A lifecycle calls it only when it
 * creates a value, so a cached value does not resolve its dependencies again.
 */
export type FactoryArguments = () => readonly unknown[];

/** Internal runtime contract for service lifecycles. */
export interface ServiceLifecycle {
	readonly lifetime: ServiceLifetime;
	readonly valueOwnership: ServiceValueOwnership;
	getInstance<T>(resolveArguments: FactoryArguments): T;
	createScope(): ServiceLifecycle;
	/**
	 * Stops new resolutions before the owning container starts its cleanup.
	 * The mode tells a lifecycle how to clean up a value that a running factory
	 * still returns. `reportUnawaitedFailure` receives the failure of a cleanup
	 * that no caller waits for.
	 */
	close(mode: DisposalMode, reportUnawaitedFailure: UnawaitedFailureSink): void;
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

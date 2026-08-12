import type { ServiceWrapper } from "./services/service-wrapper";

/** Internal contract implemented by singleton, scoped, and transient lifecycles. */
export interface ServiceLifecycle {
	getInstance<T>(...args: any): T;
	setFactory(factory: (...args: any) => any): void;
	createScope(): ServiceLifecycle;
	dispose(): void;
	disposeAsync(): Promise<void>;
}

/** Internal contract for components that assemble a service wrapper. */
export interface ServiceBuilder {
	build(lifecycle: ServiceLifecycle): ServiceWrapper;
}

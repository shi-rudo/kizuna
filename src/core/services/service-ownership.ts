import type { DisposalOwner, DisposalPlan } from "./disposal-order.js";
import type { ServiceCatalog } from "./service-catalog.js";
import type { ServiceWrapper } from "./service-wrapper.js";

const emptyPlan: DisposalPlan = Object.freeze({
	groups: Object.freeze([]),
	rootGroups: Object.freeze([]),
});

/**
 * Which service a container uses for each registration, and which services it
 * closes and disposes. A wrapper decides itself whether it owns a lifecycle;
 * a wrapper of a shared singleton does nothing on close and dispose.
 *
 * @internal
 */
export interface ServiceOwnership extends DisposalOwner<ServiceWrapper> {
	/** The services of keys with one registration that the container has. */
	readonly services: ReadonlyMap<string, ServiceWrapper>;
	/** The services of keys with multiple registrations that the container has. */
	readonly groups: ReadonlyMap<string, readonly ServiceWrapper[]>;
	/** Returns the service for a key that `services` does not hold yet. */
	obtainSingle(key: string, root: ServiceWrapper): ServiceWrapper;
	/** Returns the services for a key that `groups` does not hold yet. */
	obtainGroup(
		key: string,
		roots: readonly ServiceWrapper[],
	): readonly ServiceWrapper[];
	/** The owned services, for closing them. */
	owned(): Iterable<ServiceWrapper>;
	/** The registration indices of the owned services in sync disposal order. */
	disposalSequence(): readonly number[];
	/** The plan for async disposal of the owned services. */
	disposalPlan(): DisposalPlan;
	/** Creates the ownership of a new scope of this container. */
	forNewScope(): ServiceOwnership;
	/** Drops the services after disposal. */
	release(): void;
}

/**
 * The root uses and owns the wrapper of every registration from the start. It
 * also disposes a singleton that only a scope resolved.
 *
 * @internal
 */
export class RootOwnership implements ServiceOwnership {
	readonly services: ReadonlyMap<string, ServiceWrapper>;
	readonly groups: ReadonlyMap<string, readonly ServiceWrapper[]>;

	constructor(private readonly catalog: ServiceCatalog) {
		this.services = catalog.singles;
		this.groups = catalog.groups;
	}

	/**
	 * The maps of the root are the maps of the catalog, so they already hold
	 * every registered key, and the container does not reach this method for
	 * the root. The root would use the catalog wrapper.
	 */
	obtainSingle(_key: string, root: ServiceWrapper): ServiceWrapper {
		return root;
	}

	/** Not reached for the root, like {@link RootOwnership.obtainSingle}. */
	obtainGroup(
		_key: string,
		roots: readonly ServiceWrapper[],
	): readonly ServiceWrapper[] {
		return roots;
	}

	ownedAt(index: number): ServiceWrapper | undefined {
		return this.catalog.order[index];
	}

	owned(): Iterable<ServiceWrapper> {
		return this.catalog.order;
	}

	disposalSequence(): readonly number[] {
		return this.catalog.disposalSequence();
	}

	disposalPlan(): DisposalPlan {
		return this.catalog.disposalPlan();
	}

	forNewScope(): ServiceOwnership {
		return new ScopeOwnership(this.catalog);
	}

	/** The catalog keeps the root wrappers for the scopes that still live. */
	release(): void {}
}

/**
 * A scope owns only the services that it created, each from the root wrapper
 * on the first resolution of its key. Once the root is disposed, the scope
 * cannot create services anymore (ADR-006).
 *
 * @internal
 */
export class ScopeOwnership implements ServiceOwnership {
	private readonly ownServices = new Map<string, ServiceWrapper>();
	private readonly ownGroups = new Map<string, readonly ServiceWrapper[]>();
	/** The created services by registration index. */
	private readonly created = new Map<number, ServiceWrapper>();
	readonly services: ReadonlyMap<string, ServiceWrapper> = this.ownServices;
	readonly groups: ReadonlyMap<string, readonly ServiceWrapper[]> =
		this.ownGroups;

	constructor(private readonly catalog: ServiceCatalog) {}

	obtainSingle(key: string, root: ServiceWrapper): ServiceWrapper {
		const service = this.create(root);
		this.ownServices.set(key, service);
		return service;
	}

	obtainGroup(
		key: string,
		roots: readonly ServiceWrapper[],
	): readonly ServiceWrapper[] {
		const group = roots.map((root) => this.create(root));
		this.ownGroups.set(key, group);
		return group;
	}

	ownedAt(index: number): ServiceWrapper | undefined {
		return this.created.get(index);
	}

	owned(): Iterable<ServiceWrapper> {
		return this.created.values();
	}

	/** Sorts only the created services by their place in the shared order. */
	disposalSequence(): readonly number[] {
		const ranks = this.catalog.disposalRanks();
		return [...this.created.keys()].sort(
			(left, right) => ranks[left] - ranks[right],
		);
	}

	/**
	 * The shared plan, so an edge through a service that the scope did not
	 * create still orders the services around it. Without created services,
	 * there is nothing to walk.
	 */
	disposalPlan(): DisposalPlan {
		return this.created.size === 0 ? emptyPlan : this.catalog.disposalPlan();
	}

	forNewScope(): ServiceOwnership {
		return new ScopeOwnership(this.catalog);
	}

	release(): void {
		this.ownServices.clear();
		this.ownGroups.clear();
		this.created.clear();
	}

	/**
	 * Creates the service and records it before the container resolves it, so
	 * a factory that disposes its own scope closes the service that it runs in.
	 */
	private create(root: ServiceWrapper): ServiceWrapper {
		const service = root.createScope();
		this.created.set(this.catalog.indexOf(root), service);
		return service;
	}
}

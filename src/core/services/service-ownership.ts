import type { DisposalOwner } from "./disposal-order.js";
import { ScopeTemplate, type ServiceCatalog } from "./service-catalog.js";
import type { ServiceWrapper } from "./service-wrapper.js";

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
	/** The owned services. */
	owned(): Iterable<ServiceWrapper>;
	/** Creates the ownership of a new scope of this container. */
	forNewScope(): ServiceOwnership;
	/** Drops the services after disposal. */
	release(): void;
}

/**
 * The root uses and owns the wrapper of every registration from the start. It
 * also disposes a singleton that only a scope resolved. Its maps are the maps
 * of the catalog, so it obtains nothing later.
 *
 * @internal
 */
export class RootOwnership implements ServiceOwnership {
	readonly services: ReadonlyMap<string, ServiceWrapper>;
	readonly groups: ReadonlyMap<string, readonly ServiceWrapper[]>;
	private scopeTemplate: ScopeTemplate | undefined;

	constructor(private readonly catalog: ServiceCatalog) {
		this.services = catalog.singles;
		this.groups = catalog.groups;
	}

	obtainSingle(_key: string, root: ServiceWrapper): ServiceWrapper {
		return root;
	}

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

	/** Creates the scope template on the first scope, while the root is open. */
	forNewScope(): ServiceOwnership {
		this.scopeTemplate ??= new ScopeTemplate(this.catalog);
		return new ScopeOwnership(this.catalog, this.scopeTemplate);
	}

	/** The catalog keeps the root wrappers for the scopes that still live. */
	release(): void {}
}

/**
 * A scope owns only the services that it created, each on the first
 * resolution of its key.
 *
 * @internal
 */
export class ScopeOwnership implements ServiceOwnership {
	private readonly ownServices = new Map<string, ServiceWrapper>();
	private readonly ownGroups = new Map<string, readonly ServiceWrapper[]>();
	private readonly createdByRoot = new Map<ServiceWrapper, ServiceWrapper>();
	readonly services: ReadonlyMap<string, ServiceWrapper> = this.ownServices;
	readonly groups: ReadonlyMap<string, readonly ServiceWrapper[]> =
		this.ownGroups;

	constructor(
		private readonly catalog: ServiceCatalog,
		private readonly template: ScopeTemplate,
	) {}

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
		return this.createdByRoot.get(this.catalog.order[index]);
	}

	owned(): Iterable<ServiceWrapper> {
		return this.createdByRoot.values();
	}

	forNewScope(): ServiceOwnership {
		return new ScopeOwnership(this.catalog, this.template);
	}

	release(): void {
		this.ownServices.clear();
		this.ownGroups.clear();
		this.createdByRoot.clear();
	}

	/**
	 * Creates the service and records it before the container resolves it, so
	 * a factory that disposes its own scope closes the service that it runs in.
	 */
	private create(root: ServiceWrapper): ServiceWrapper {
		const service = this.template.createService(root);
		this.createdByRoot.set(root, service);
		return service;
	}
}

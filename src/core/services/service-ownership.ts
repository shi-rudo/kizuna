import type { DisposalMode } from "../contracts.js";
import type { DiagnosticsReporter } from "../diagnostics.js";
import { ContainerDisposedError } from "../errors.js";
import {
	createDisposalSubplan,
	type DisposalOwner,
	type DisposalPlan,
} from "./disposal-order.js";
import type { ServiceCatalog } from "./service-catalog.js";
import type { ServiceWrapper } from "./service-wrapper.js";

const emptyPlan: DisposalPlan = { groups: [], rootGroups: [] };

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
	/**
	 * Returns the service for a key that `services` does not hold, or undefined
	 * when the key has no single registration.
	 */
	obtainSingle(key: string): ServiceWrapper | undefined;
	/**
	 * Returns the services for a key that `groups` does not hold, or undefined
	 * when the key has no multi-registration.
	 */
	obtainGroup(key: string): readonly ServiceWrapper[] | undefined;
	/** Stops new resolutions of the owned services before cleanup starts. */
	close(mode: DisposalMode, diagnostics: DiagnosticsReporter): void;
	/** The registration indices of the owned services in sync disposal order. */
	disposalSequence(): readonly number[];
	/** The plan for async disposal of the owned services. */
	disposalPlan(): DisposalPlan;
	/** Creates the ownership of a new scope of this container. */
	forNewScope(): ServiceOwnership;
	/** Drops the services after disposal. */
	release(): void;
}

/** Whether the root still lets its scopes create services. */
interface RootState {
	readonly isClosed: boolean;
}

/**
 * The root uses and owns the wrapper of every registration from the start. It
 * also disposes a singleton that only a scope resolved.
 *
 * @internal
 */
export class RootOwnership implements ServiceOwnership, RootState {
	readonly services: ReadonlyMap<string, ServiceWrapper>;
	readonly groups: ReadonlyMap<string, readonly ServiceWrapper[]>;
	private closed = false;

	constructor(private readonly catalog: ServiceCatalog) {
		this.services = catalog.singles;
		this.groups = catalog.groups;
	}

	/** True once the root starts its disposal. Its scopes then create nothing. */
	get isClosed(): boolean {
		return this.closed;
	}

	/** The root holds every registration, so a key it does not hold has none. */
	obtainSingle(): undefined {
		return undefined;
	}

	/** The root holds every registration, so a key it does not hold has none. */
	obtainGroup(): undefined {
		return undefined;
	}

	ownedAt(index: number): ServiceWrapper | undefined {
		return this.catalog.order[index];
	}

	close(mode: DisposalMode, diagnostics: DiagnosticsReporter): void {
		this.closed = true;
		for (const service of this.catalog.order) {
			service.close(mode, diagnostics);
		}
	}

	disposalSequence(): readonly number[] {
		return this.catalog.disposalSequence();
	}

	disposalPlan(): DisposalPlan {
		return this.catalog.disposalPlan();
	}

	forNewScope(): ServiceOwnership {
		return new ScopeOwnership(this.catalog, this);
	}

	release(): void {
		this.catalog.release();
	}
}

/**
 * A scope owns only the services that it created, each from the root wrapper
 * on the first resolution of its key. Once the root starts its disposal, the
 * scope cannot create services anymore (ADR-006).
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

	constructor(
		private readonly catalog: ServiceCatalog,
		private readonly root: RootState,
	) {}

	obtainSingle(key: string): ServiceWrapper | undefined {
		this.ensureRootOpen();
		const root = this.catalog.singles.get(key);
		if (!root) {
			return undefined;
		}
		const service = root.createScope();
		this.record(root, service);
		this.ownServices.set(key, service);
		return service;
	}

	/** Creates all services of the group before it records any of them. */
	obtainGroup(key: string): readonly ServiceWrapper[] | undefined {
		this.ensureRootOpen();
		const roots = this.catalog.groups.get(key);
		if (!roots) {
			return undefined;
		}
		const group = roots.map((root) => root.createScope());
		roots.forEach((root, position) => {
			this.record(root, group[position]);
		});
		this.ownGroups.set(key, group);
		return group;
	}

	ownedAt(index: number): ServiceWrapper | undefined {
		return this.created.get(index);
	}

	/** Closes the created services in registration order. */
	close(mode: DisposalMode, diagnostics: DiagnosticsReporter): void {
		const indices = [...this.created.keys()].sort(
			(left, right) => left - right,
		);
		for (const index of indices) {
			this.created.get(index)?.close(mode, diagnostics);
		}
	}

	/** Sorts only the created services by their place in the shared order. */
	disposalSequence(): readonly number[] {
		const ranks = this.catalog.disposalRanks();
		return [...this.created.keys()].sort(
			(left, right) => ranks[left] - ranks[right],
		);
	}

	/**
	 * Reduces the shared plan to the created services, so an edge through a
	 * service that the scope did not create still orders the services around
	 * it, and the work follows what the scope created.
	 */
	disposalPlan(): DisposalPlan {
		if (this.created.size === 0) {
			return emptyPlan;
		}
		return createDisposalSubplan(
			this.catalog.disposalPlan(),
			this.catalog.disposalGroupOf(),
			this.created.keys(),
		);
	}

	forNewScope(): ServiceOwnership {
		return new ScopeOwnership(this.catalog, this.root);
	}

	release(): void {
		this.ownServices.clear();
		this.ownGroups.clear();
		this.created.clear();
	}

	private ensureRootOpen(): void {
		if (this.root.isClosed) {
			throw new ContainerDisposedError();
		}
	}

	/**
	 * Records a service before the container resolves it, so a factory that
	 * disposes its own scope closes the service that it runs in.
	 */
	private record(root: ServiceWrapper, service: ServiceWrapper): void {
		this.created.set(this.catalog.indexOf(root), service);
	}
}

import {
	createDisposalPlan,
	createDisposalSequence,
	createGroupIndex,
	type DisposalPlan,
} from "./disposal-order.js";
import type { ServiceWrapper } from "./service-wrapper.js";

/**
 * The registrations of one built container, with the service wrappers of its
 * root. A root and all of its scopes share the catalog. It copies the
 * collections of the builder and does not change while the root lives.
 *
 * The disposal plan depends only on the keys and declared dependencies, so the
 * catalog computes it once on first use. It covers every registration, also
 * one that a scope never created: an edge through it still orders the services
 * around it (ADR-011).
 *
 * @internal
 */
export class ServiceCatalog {
	private readonly singleMap: Map<string, ServiceWrapper>;
	private readonly groupMap: Map<string, readonly ServiceWrapper[]>;
	private readonly registrations: ServiceWrapper[];
	/** The root wrappers of keys with one registration. */
	readonly singles: ReadonlyMap<string, ServiceWrapper>;
	/** The root wrappers of keys with multiple registrations. */
	readonly groups: ReadonlyMap<string, readonly ServiceWrapper[]>;
	/** All root wrappers in registration order. A disposal plan names them by index. */
	readonly order: readonly ServiceWrapper[];
	private indices: ReadonlyMap<ServiceWrapper, number> | undefined;
	private plan: DisposalPlan | undefined;
	private sequence: readonly number[] | undefined;
	private ranks: readonly number[] | undefined;
	private groupOf: readonly number[] | undefined;

	constructor(
		registrations: ReadonlyMap<string, ServiceWrapper>,
		multiRegistrations: ReadonlyMap<string, readonly ServiceWrapper[]>,
		registrationOrder: readonly ServiceWrapper[],
	) {
		this.singleMap = new Map(registrations);
		this.groupMap = new Map(
			[...multiRegistrations].map(([key, services]) => [key, [...services]]),
		);
		this.registrations = [...registrationOrder];
		this.singles = this.singleMap;
		this.groups = this.groupMap;
		this.order = this.registrations;
	}

	/** The registration index of a root wrapper. */
	indexOf(root: ServiceWrapper): number {
		this.indices ??= new Map(
			this.registrations.map((service, position) => [service, position]),
		);
		const index = this.indices.get(root);
		if (index === undefined) {
			throw new Error(`Unknown registration '${root.getName()}'`);
		}
		return index;
	}

	/** The async disposal plan over all registrations. */
	disposalPlan(): DisposalPlan {
		this.plan ??= createDisposalPlan(this.registrations);
		return this.plan;
	}

	/** The sync disposal order over all registrations. */
	disposalSequence(): readonly number[] {
		this.sequence ??= createDisposalSequence(this.disposalPlan());
		return this.sequence;
	}

	/** The position of each registration index in the sync disposal order. */
	disposalRanks(): readonly number[] {
		if (!this.ranks) {
			const sequence = this.disposalSequence();
			const ranks = new Array<number>(sequence.length);
			sequence.forEach((index, rank) => {
				ranks[index] = rank;
			});
			this.ranks = ranks;
		}
		return this.ranks;
	}

	/** The group of each registration index in the disposal plan. */
	disposalGroupOf(): readonly number[] {
		this.groupOf ??= createGroupIndex(this.disposalPlan());
		return this.groupOf;
	}

	/**
	 * Drops the registrations once the root is disposed. A scope that outlives
	 * the root cannot create services anymore, but it still disposes the
	 * services that it created by the disposal plan. The plan therefore must
	 * exist before the registrations go; the order data derives from it.
	 */
	release(): void {
		this.disposalPlan();
		this.singleMap.clear();
		this.groupMap.clear();
		this.registrations.length = 0;
		this.indices = undefined;
	}
}

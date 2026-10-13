import {
	createDisposalPlan,
	createDisposalSequence,
	type DisposalPlan,
} from "./disposal-order.js";
import type { ServiceWrapper } from "./service-wrapper.js";

/**
 * The registrations of one built container, with the service wrappers of its
 * root. A root and all of its scopes share the catalog, and it never changes:
 * it copies the collections of the builder.
 *
 * The disposal plan depends only on the keys and declared dependencies, so the
 * catalog computes it once on first use. It covers every registration, also
 * one that a scope never created: an edge through it still orders the services
 * around it (ADR-011).
 *
 * @internal
 */
export class ServiceCatalog {
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

	constructor(
		registrations: ReadonlyMap<string, ServiceWrapper>,
		multiRegistrations: ReadonlyMap<string, readonly ServiceWrapper[]>,
		registrationOrder: readonly ServiceWrapper[],
	) {
		this.singles = new Map(registrations);
		this.groups = new Map(
			[...multiRegistrations].map(([key, services]) => [key, [...services]]),
		);
		this.order = [...registrationOrder];
	}

	/** The registration index of a root wrapper. */
	indexOf(root: ServiceWrapper): number {
		this.indices ??= new Map(
			this.order.map((service, position) => [service, position]),
		);
		const index = this.indices.get(root);
		if (index === undefined) {
			throw new Error(
				`Registration '${root.getName()}' is missing from the registration order`,
			);
		}
		return index;
	}

	/** The async disposal plan over all registrations. */
	disposalPlan(): DisposalPlan {
		this.plan ??= createDisposalPlan(this.order);
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
			const ranks = new Array<number>(this.order.length);
			this.disposalSequence().forEach((index, rank) => {
				ranks[index] = rank;
			});
			this.ranks = ranks;
		}
		return this.ranks;
	}
}

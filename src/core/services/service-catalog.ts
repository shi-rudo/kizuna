import {
	createDisposalPlan,
	createDisposalSequence,
	type DisposalPlan,
} from "./disposal-order.js";
import type { ServiceWrapper } from "./service-wrapper.js";

/**
 * The registrations of one built container, with the service wrappers of its
 * root. A root and all of its scopes share the catalog. It holds the maps of
 * the builder, which no longer change after `build()`.
 *
 * The disposal plan depends only on the keys and declared dependencies, so the
 * catalog computes it once on first use. It covers every registration, also
 * one that a scope never created: an edge through it still orders the services
 * around it (ADR-011).
 *
 * @internal
 */
export class ServiceCatalog {
	private plan: DisposalPlan | undefined;
	private sequence: readonly number[] | undefined;

	constructor(
		/** The root wrappers of keys with one registration. */
		readonly singles: ReadonlyMap<string, ServiceWrapper>,
		/** The root wrappers of keys with multiple registrations. */
		readonly groups: ReadonlyMap<string, readonly ServiceWrapper[]>,
		/** All root wrappers in registration order. A disposal plan names them by index. */
		readonly order: readonly ServiceWrapper[],
	) {}

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
}

/**
 * The prototypes from which scopes create their services: one per
 * registration, replicated from the root wrapper by the rules of ADR-006.
 *
 * A prototype is never resolved, closed, or disposed. It therefore keeps its
 * factory after the root is disposed, and a live scope can still create a
 * scoped service for the first time.
 *
 * @internal
 */
export class ScopeTemplate {
	private readonly prototypes: ReadonlyMap<ServiceWrapper, ServiceWrapper>;

	constructor(catalog: ServiceCatalog) {
		this.prototypes = new Map(
			catalog.order.map((root) => [root, root.createScope()]),
		);
	}

	/** Creates the service of one registration for a new scope. */
	createService(root: ServiceWrapper): ServiceWrapper {
		const prototype = this.prototypes.get(root);
		if (!prototype) {
			throw new Error(
				`Registration '${root.getName()}' is missing from the scope template`,
			);
		}
		return prototype.createScope();
	}
}

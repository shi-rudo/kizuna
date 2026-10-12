import { findStronglyConnectedComponents } from "./strongly-connected-components.js";

/** The facts of one registration that decide its place in the disposal order. */
export interface DisposalNode {
	getName(): string;
	getDependencies(): readonly string[];
}

/** One circular or acyclic unit in the disposal graph. */
export interface DisposalGroup {
	/** Registration indices of the services in this group. */
	readonly members: readonly number[];
	readonly dependencyGroups: readonly number[];
	readonly consumerGroupCount: number;
	readonly registrationIndex: number;
}

/** A consumer-first graph whose group indices are local to this plan. */
export interface DisposalPlan {
	readonly groups: readonly DisposalGroup[];
	readonly rootGroups: readonly number[];
}

/** A cleanup that threw or rejected, with the registration index of its service. */
export interface DisposalAttempt<TService> {
	readonly index: number;
	readonly service: TService;
	readonly error: unknown;
}

/**
 * Returns the service that a container owns at a registration index, or
 * undefined when the container owns none there.
 */
export type OwnedServiceAt<TService> = (index: number) => TService | undefined;

/**
 * Creates the stable sync disposal order in consumer-before-dependency layers.
 *
 * Services in one layer have no ordering constraint between them. They follow
 * registration order. A dependency is not present until a later layer. A
 * circular component forms one group because no valid order exists inside it.
 */
export function createDisposalSequence(plan: DisposalPlan): readonly number[] {
	const remainingConsumerGroups = plan.groups.map(
		(group) => group.consumerGroupCount,
	);
	let ready = [...plan.rootGroups];
	const sequence: number[] = [];

	while (ready.length > 0) {
		ready.sort(
			(left, right) =>
				plan.groups[left].registrationIndex -
				plan.groups[right].registrationIndex,
		);

		for (const groupIndex of ready) {
			sequence.push(...plan.groups[groupIndex].members);
		}

		const next: number[] = [];
		for (const groupIndex of ready) {
			for (const dependencyGroup of plan.groups[groupIndex].dependencyGroups) {
				remainingConsumerGroups[dependencyGroup]--;
				if (remainingConsumerGroups[dependencyGroup] === 0) {
					next.push(dependencyGroup);
				}
			}
		}
		ready = next;
	}

	return sequence;
}

/** Creates the disposal graph over registration indices. */
export function createDisposalPlan(
	registrationOrder: readonly DisposalNode[],
): DisposalPlan {
	if (registrationOrder.length === 0) {
		return { groups: [], rootGroups: [] };
	}

	const indicesByKey = new Map<string, number[]>();
	registrationOrder.forEach((node, index) => {
		const key = node.getName();
		const indices = indicesByKey.get(key);
		if (indices) {
			indices.push(index);
		} else {
			indicesByKey.set(key, [index]);
		}
	});

	const edges: number[][] = registrationOrder.map(() => []);
	const reverseEdges: number[][] = registrationOrder.map(() => []);

	registrationOrder.forEach((node, consumerIndex) => {
		const dependencyIndices = new Set<number>();
		for (const dependencyKey of node.getDependencies()) {
			for (const dependencyIndex of indicesByKey.get(dependencyKey) ?? []) {
				dependencyIndices.add(dependencyIndex);
			}
		}

		for (const dependencyIndex of dependencyIndices) {
			edges[consumerIndex].push(dependencyIndex);
			reverseEdges[dependencyIndex].push(consumerIndex);
		}
	});

	const components = findStronglyConnectedComponents(edges, reverseEdges);
	const componentByNode = new Array<number>(registrationOrder.length);
	components.forEach((component, componentIndex) => {
		component.sort((left, right) => left - right);
		for (const node of component) {
			componentByNode[node] = componentIndex;
		}
	});

	const componentEdges = components.map(() => new Set<number>());
	const indegrees = components.map(() => 0);

	edges.forEach((dependencies, consumerIndex) => {
		const consumerComponent = componentByNode[consumerIndex];
		for (const dependencyIndex of dependencies) {
			const dependencyComponent = componentByNode[dependencyIndex];
			if (
				consumerComponent !== dependencyComponent &&
				!componentEdges[consumerComponent].has(dependencyComponent)
			) {
				componentEdges[consumerComponent].add(dependencyComponent);
				indegrees[dependencyComponent]++;
			}
		}
	});

	const componentOrder = components.map((component) => component[0]);
	const groups = components.map((component, componentIndex) => ({
		members: component,
		dependencyGroups: [...componentEdges[componentIndex]].sort(
			(left, right) => componentOrder[left] - componentOrder[right],
		),
		consumerGroupCount: indegrees[componentIndex],
		registrationIndex: componentOrder[componentIndex],
	}));
	const rootGroups = groups
		.map((_, index) => index)
		.filter((index) => groups[index].consumerGroupCount === 0)
		.sort(
			(left, right) =>
				groups[left].registrationIndex - groups[right].registrationIndex,
		);

	return { groups, rootGroups };
}

/**
 * Disposes the owned services in sequence order. A failure does not stop
 * later cleanup. The failures keep sequence order.
 */
export function disposeInSequence<TService extends { dispose(): void }>(
	sequence: readonly number[],
	ownedAt: OwnedServiceAt<TService>,
): readonly DisposalAttempt<TService>[] {
	const failures: DisposalAttempt<TService>[] = [];
	for (const index of sequence) {
		const service = ownedAt(index);
		if (service === undefined) {
			continue;
		}
		try {
			service.dispose();
		} catch (error) {
			failures.push({ index, service, error });
		}
	}
	return failures;
}

/**
 * Disposes the owned services along the plan. Root groups start in parallel.
 * A group starts after all of its consumer groups settle. A rejection does
 * not stop other cleanup. The failures follow registration order.
 */
export async function disposeByPlan<
	TService extends { disposeAsync(): Promise<void> },
>(
	plan: DisposalPlan,
	ownedAt: OwnedServiceAt<TService>,
): Promise<readonly DisposalAttempt<TService>[]> {
	if (plan.groups.length === 0) {
		return [];
	}

	const failures: DisposalAttempt<TService>[] = [];
	const remainingConsumerGroups = plan.groups.map(
		(group) => group.consumerGroupCount,
	);

	await new Promise<void>((resolve) => {
		let completedGroups = 0;

		const startGroup = (groupIndex: number): void => {
			const tasks = plan.groups[groupIndex].members.map(async (index) => {
				const service = ownedAt(index);
				if (service === undefined) {
					return;
				}
				try {
					await service.disposeAsync();
				} catch (error) {
					failures.push({ index, service, error });
				}
			});

			void Promise.all(tasks).then(() => {
				completedGroups++;

				for (const dependencyGroup of plan.groups[groupIndex]
					.dependencyGroups) {
					remainingConsumerGroups[dependencyGroup]--;
					if (remainingConsumerGroups[dependencyGroup] === 0) {
						startGroup(dependencyGroup);
					}
				}

				if (completedGroups === plan.groups.length) {
					resolve();
				}
			});
		};

		for (const groupIndex of plan.rootGroups) {
			startGroup(groupIndex);
		}
	});

	return failures.sort((left, right) => left.index - right.index);
}

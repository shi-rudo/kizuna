import type { ServiceWrapper } from "./service-wrapper.js";

/** One circular or acyclic unit in the disposal graph. */
export interface DisposalGroup {
	readonly resolvers: readonly ServiceWrapper[];
	readonly dependencyGroups: readonly number[];
	readonly consumerGroupCount: number;
	readonly registrationIndex: number;
}

/** A consumer-first graph whose group indices are local to this plan. */
export interface DisposalPlan {
	readonly groups: readonly DisposalGroup[];
	readonly rootGroups: readonly number[];
}

/**
 * Creates stable disposal layers in consumer-before-dependency order.
 *
 * Services in one layer have no ordering constraint between them and can be
 * disposed in parallel. A dependency is not present until a later layer. A
 * circular component forms one layer because no valid order exists inside it.
 */
export function createDisposalLayers(
	registrationOrder: readonly ServiceWrapper[],
): readonly (readonly ServiceWrapper[])[] {
	const plan = createDisposalPlan(registrationOrder);
	if (plan.groups.length === 0) {
		return [];
	}

	const remainingConsumerGroups = plan.groups.map(
		(group) => group.consumerGroupCount,
	);
	let ready = [...plan.rootGroups];
	const layers: ServiceWrapper[][] = [];

	while (ready.length > 0) {
		ready.sort(
			(left, right) =>
				plan.groups[left].registrationIndex -
				plan.groups[right].registrationIndex,
		);

		layers.push(
			ready.flatMap((groupIndex) => plan.groups[groupIndex].resolvers),
		);

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

	return layers;
}

/** Creates the disposal graph without scheduling its async work. */
export function createDisposalPlan(
	registrationOrder: readonly ServiceWrapper[],
): DisposalPlan {
	if (registrationOrder.length === 0) {
		return { groups: [], rootGroups: [] };
	}

	const indicesByKey = new Map<string, number[]>();
	registrationOrder.forEach((resolver, index) => {
		const key = resolver.getName();
		const indices = indicesByKey.get(key);
		if (indices) {
			indices.push(index);
		} else {
			indicesByKey.set(key, [index]);
		}
	});

	const edges: number[][] = registrationOrder.map(() => []);
	const reverseEdges: number[][] = registrationOrder.map(() => []);

	registrationOrder.forEach((resolver, consumerIndex) => {
		const dependencyIndices = new Set<number>();
		for (const dependencyKey of resolver.getDependencies()) {
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
		resolvers: component.map((nodeIndex) => registrationOrder[nodeIndex]),
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

/** Finds graph cycles without recursion so large containers do not overflow the stack. */
function findStronglyConnectedComponents(
	edges: readonly (readonly number[])[],
	reverseEdges: readonly (readonly number[])[],
): number[][] {
	const visited = edges.map(() => false);
	const finishOrder: number[] = [];

	for (let root = 0; root < edges.length; root++) {
		if (visited[root]) {
			continue;
		}

		visited[root] = true;
		const stack: Array<{ node: number; nextEdge: number }> = [
			{ node: root, nextEdge: 0 },
		];

		while (stack.length > 0) {
			const frame = stack[stack.length - 1];
			const dependencies = edges[frame.node];
			if (frame.nextEdge < dependencies.length) {
				const dependency = dependencies[frame.nextEdge];
				frame.nextEdge++;
				if (!visited[dependency]) {
					visited[dependency] = true;
					stack.push({ node: dependency, nextEdge: 0 });
				}
				continue;
			}

			finishOrder.push(frame.node);
			stack.pop();
		}
	}

	const componentByNode = edges.map(() => -1);
	const components: number[][] = [];

	for (let index = finishOrder.length - 1; index >= 0; index--) {
		const root = finishOrder[index];
		if (componentByNode[root] !== -1) {
			continue;
		}

		const componentIndex = components.length;
		const component: number[] = [];
		const stack = [root];
		componentByNode[root] = componentIndex;

		while (stack.length > 0) {
			const node = stack.pop();
			if (node === undefined) {
				continue;
			}
			component.push(node);

			for (const consumer of reverseEdges[node]) {
				if (componentByNode[consumer] === -1) {
					componentByNode[consumer] = componentIndex;
					stack.push(consumer);
				}
			}
		}

		components.push(component);
	}

	return components;
}

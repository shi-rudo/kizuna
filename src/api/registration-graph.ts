import type { ServiceWrapper } from "../core/services/service-wrapper.js";
import { findStronglyConnectedComponents } from "../core/services/strongly-connected-components.js";
import { createValidationIssue, type ValidationIssue } from "./validation.js";

interface RegistrationNode {
	readonly id: number;
	readonly key: string;
	readonly registrationIndex?: number;
	readonly resolver: ServiceWrapper;
}

interface RegistrationGraph {
	readonly nodes: readonly RegistrationNode[];
	readonly nodesByKey: ReadonlyMap<string, readonly RegistrationNode[]>;
	readonly edges: readonly (readonly number[])[];
	readonly reverseEdges: readonly (readonly number[])[];
}

const buildRegistrationGraph = (
	registrations: ReadonlyMap<string, ServiceWrapper>,
	multiRegistrations: ReadonlyMap<string, readonly ServiceWrapper[]>,
): RegistrationGraph => {
	const nodes: RegistrationNode[] = [];
	const nodesByKey = new Map<string, RegistrationNode[]>();

	const addNode = (
		key: string,
		resolver: ServiceWrapper,
		registrationIndex?: number,
	): void => {
		const node: RegistrationNode = {
			id: nodes.length,
			key,
			registrationIndex,
			resolver,
		};
		nodes.push(node);
		const keyNodes = nodesByKey.get(key);
		if (keyNodes) {
			keyNodes.push(node);
		} else {
			nodesByKey.set(key, [node]);
		}
	};

	registrations.forEach((resolver, key) => {
		addNode(key, resolver);
	});
	multiRegistrations.forEach((resolvers, key) => {
		resolvers.forEach((resolver, index) => {
			addNode(key, resolver, index);
		});
	});

	const edges: number[][] = nodes.map(() => []);
	const reverseEdges: number[][] = nodes.map(() => []);
	for (const node of nodes) {
		const targetIds = new Set<number>();
		for (const dependencyKey of node.resolver.getDependencies()) {
			for (const target of nodesByKey.get(dependencyKey) ?? []) {
				if (targetIds.has(target.id)) {
					continue;
				}
				targetIds.add(target.id);
				edges[node.id].push(target.id);
				reverseEdges[target.id].push(node.id);
			}
		}
	}

	return { edges, nodes, nodesByKey, reverseEdges };
};

const nodeLabel = (node: RegistrationNode): string =>
	node.registrationIndex === undefined
		? `Service '${node.key}'`
		: `Multi-service '${node.key}' registration ${node.registrationIndex}`;

const issueLocation = (
	node: RegistrationNode,
): Pick<ValidationIssue, "registrationIndex" | "serviceKey"> => ({
	...(node.registrationIndex === undefined
		? {}
		: { registrationIndex: node.registrationIndex }),
	serviceKey: node.key,
});

const validateNodes = (graph: RegistrationGraph): ValidationIssue[] => {
	const issues: ValidationIssue[] = [];

	for (const node of graph.nodes) {
		if (node.key.trim() === "") {
			issues.push(
				createValidationIssue({
					code: "INVALID_SERVICE_KEY",
					message: "Service registration has empty or invalid name",
					path: [node.key],
					...issueLocation(node),
				}),
			);
			continue;
		}

		if (node.resolver.isDisposed()) {
			issues.push(
				createValidationIssue({
					code: "DISPOSED_REGISTRATION",
					message: `${nodeLabel(node)} has been disposed`,
					path: [node.key],
					...issueLocation(node),
				}),
			);
			continue;
		}

		for (const dependencyKey of node.resolver.getDependencies()) {
			if (!graph.nodesByKey.has(dependencyKey)) {
				issues.push(
					createValidationIssue({
						code: "MISSING_DEPENDENCY",
						dependencyKey,
						message: `${nodeLabel(node)} depends on unregistered service '${dependencyKey}'`,
						path: [node.key, dependencyKey],
						...issueLocation(node),
					}),
				);
			}
		}
	}

	return issues;
};

const detectCaptiveDependencies = (
	graph: RegistrationGraph,
): ValidationIssue[] => {
	const issues: ValidationIssue[] = [];

	for (const root of graph.nodes) {
		if (root.resolver.getLifetime() !== "singleton") {
			continue;
		}

		const visited = new Uint8Array(graph.nodes.length);
		const predecessors = new Int32Array(graph.nodes.length);
		predecessors.fill(-1);
		visited[root.id] = 1;
		const stack: number[] = [];

		const addTargets = (nodeId: number): void => {
			const targets = graph.edges[nodeId];
			for (let index = targets.length - 1; index >= 0; index--) {
				const targetId = targets[index];
				if (visited[targetId] === 1) {
					continue;
				}
				visited[targetId] = 1;
				predecessors[targetId] = nodeId;
				stack.push(targetId);
			}
		};

		addTargets(root.id);
		while (stack.length > 0) {
			const nodeId = stack.pop();
			if (nodeId === undefined) {
				continue;
			}
			const node = graph.nodes[nodeId];
			if (node.resolver.getLifetime() !== "scoped") {
				addTargets(nodeId);
				continue;
			}

			const pathIds = [nodeId];
			let predecessor = predecessors[nodeId];
			while (predecessor !== -1) {
				pathIds.push(predecessor);
				predecessor = predecessors[predecessor];
			}
			pathIds.reverse();
			const path = pathIds.map((id) => graph.nodes[id].key);

			issues.push(
				createValidationIssue({
					code: "CAPTIVE_DEPENDENCY",
					dependencyKey: node.key,
					...(node.registrationIndex === undefined
						? {}
						: {
								dependencyRegistrationIndex: node.registrationIndex,
							}),
					message:
						`${nodeLabel(root)} is a singleton but depends on scoped service '${node.key}' ` +
						`(captive dependency) via ${path.join(" -> ")}: ` +
						`the scoped instance would be captured beyond its scope's lifetime`,
					path,
					...issueLocation(root),
				}),
			);
		}
	}

	return issues;
};

const lowestNodeId = (component: readonly number[]): number => {
	let lowest = component[0];
	for (let index = 1; index < component.length; index++) {
		if (component[index] < lowest) {
			lowest = component[index];
		}
	}
	return lowest;
};

const isCyclicComponent = (
	graph: RegistrationGraph,
	component: readonly number[],
): boolean => {
	if (component.length > 1) {
		return true;
	}
	const onlyNodeId = component[0];
	return graph.edges[onlyNodeId]?.includes(onlyNodeId) ?? false;
};

const findCyclePath = (
	graph: RegistrationGraph,
	component: readonly number[],
): readonly number[] | undefined => {
	const rootId = lowestNodeId(component);
	const memberIds = new Set(component);
	const visited = new Uint8Array(graph.nodes.length);
	visited[rootId] = 1;
	const stack: Array<{ nodeId: number; nextEdge: number }> = [
		{ nodeId: rootId, nextEdge: 0 },
	];

	while (stack.length > 0) {
		const frame = stack[stack.length - 1];
		const targets = graph.edges[frame.nodeId];
		if (frame.nextEdge >= targets.length) {
			stack.pop();
			continue;
		}

		const targetId = targets[frame.nextEdge];
		frame.nextEdge++;
		if (!memberIds.has(targetId)) {
			continue;
		}
		if (targetId === rootId) {
			return [...stack.map(({ nodeId }) => nodeId), rootId];
		}
		if (visited[targetId] === 1) {
			continue;
		}
		visited[targetId] = 1;
		stack.push({ nodeId: targetId, nextEdge: 0 });
	}

	return undefined;
};

const detectCircularDependencies = (
	graph: RegistrationGraph,
): ValidationIssue[] => {
	const cyclicComponents = findStronglyConnectedComponents(
		graph.edges,
		graph.reverseEdges,
	)
		.filter((component) => isCyclicComponent(graph, component))
		.sort((left, right) => lowestNodeId(left) - lowestNodeId(right));

	return cyclicComponents.flatMap((component) => {
		const rootId = lowestNodeId(component);
		const root = graph.nodes[rootId];
		const cycleIds = findCyclePath(graph, component);
		if (!cycleIds) {
			return [];
		}
		const keyPath = cycleIds.map((nodeId) => graph.nodes[nodeId].key);
		return [
			createValidationIssue({
				code: "CIRCULAR_DEPENDENCY",
				dependencyKey: root.key,
				...(root.registrationIndex === undefined
					? {}
					: {
							dependencyRegistrationIndex: root.registrationIndex,
						}),
				message: `Circular dependency detected: ${keyPath.join(" -> ")}`,
				path: keyPath,
				...issueLocation(root),
			}),
		];
	});
};

/** Validates every single and multi-registration as one explicit graph node. */
export const validateRegistrationGraph = (
	registrations: ReadonlyMap<string, ServiceWrapper>,
	multiRegistrations: ReadonlyMap<string, readonly ServiceWrapper[]>,
): readonly ValidationIssue[] => {
	const graph = buildRegistrationGraph(registrations, multiRegistrations);
	return Object.freeze([
		...validateNodes(graph),
		...detectCaptiveDependencies(graph),
		...detectCircularDependencies(graph),
	]);
};

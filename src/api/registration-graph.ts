import type { ServiceLifetime } from "../core/contracts.js";
import type { ServiceWrapper } from "../core/services/service-wrapper.js";
import { findStronglyConnectedComponents } from "../core/services/strongly-connected-components.js";
import { createValidationIssue, type ValidationIssue } from "./validation.js";

export interface RegistrationSnapshot {
	readonly dependencies: readonly string[];
	readonly disposed: boolean;
	readonly key: string;
	readonly lifetime: ServiceLifetime;
	readonly registrationIndex?: number;
}

interface RegistrationNode extends RegistrationSnapshot {
	readonly id: number;
}

interface RegistrationGraph {
	readonly nodes: readonly RegistrationNode[];
	readonly nodesByKey: ReadonlyMap<string, readonly RegistrationNode[]>;
	readonly edges: readonly (readonly number[])[];
	readonly reverseEdges: readonly (readonly number[])[];
}

const buildRegistrationGraph = (
	snapshots: readonly RegistrationSnapshot[],
): RegistrationGraph => {
	const nodes: RegistrationNode[] = [];
	const nodesByKey = new Map<string, RegistrationNode[]>();

	const addNode = (snapshot: RegistrationSnapshot): void => {
		const node: RegistrationNode = {
			id: nodes.length,
			...snapshot,
		};
		nodes.push(node);
		const keyNodes = nodesByKey.get(node.key);
		if (keyNodes) {
			keyNodes.push(node);
		} else {
			nodesByKey.set(node.key, [node]);
		}
	};

	for (const snapshot of snapshots) {
		addNode(snapshot);
	}

	const edges: number[][] = nodes.map(() => []);
	const reverseEdges: number[][] = nodes.map(() => []);
	for (const node of nodes) {
		const targetIds = new Set<number>();
		for (const dependencyKey of node.dependencies) {
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

const pathSegment = (node: RegistrationNode) => ({
	key: node.key,
	...(node.registrationIndex === undefined
		? {}
		: { registrationIndex: node.registrationIndex }),
});

const validateNodes = (graph: RegistrationGraph): ValidationIssue[] => {
	const issues: ValidationIssue[] = [];

	for (const node of graph.nodes) {
		if (node.key.trim() === "") {
			issues.push(
				createValidationIssue({
					code: "INVALID_SERVICE_KEY",
					message: "Service registration has empty or invalid name",
					pathSegments: [pathSegment(node)],
					...issueLocation(node),
				}),
			);
			continue;
		}

		if (node.disposed) {
			issues.push(
				createValidationIssue({
					code: "DISPOSED_REGISTRATION",
					message: `${nodeLabel(node)} has been disposed`,
					pathSegments: [pathSegment(node)],
					...issueLocation(node),
				}),
			);
			continue;
		}

		for (const dependencyKey of node.dependencies) {
			if (!graph.nodesByKey.has(dependencyKey)) {
				issues.push(
					createValidationIssue({
						code: "MISSING_DEPENDENCY",
						dependencyKey,
						message: `${nodeLabel(node)} depends on unregistered service '${dependencyKey}'`,
						pathSegments: [pathSegment(node), { key: dependencyKey }],
						...issueLocation(node),
					}),
				);
			}
		}
	}

	return issues;
};

const findNodesThatReachScoped = (graph: RegistrationGraph): Uint8Array => {
	const canReachScoped = new Uint8Array(graph.nodes.length);
	const reachableStack: number[] = [];

	for (const node of graph.nodes) {
		if (node.lifetime === "scoped") {
			canReachScoped[node.id] = 1;
			reachableStack.push(node.id);
		}
	}

	while (reachableStack.length > 0) {
		const nodeId = reachableStack.pop();
		if (nodeId === undefined) {
			continue;
		}
		for (const consumerId of graph.reverseEdges[nodeId]) {
			if (canReachScoped[consumerId] === 0) {
				canReachScoped[consumerId] = 1;
				reachableStack.push(consumerId);
			}
		}
	}
	return canReachScoped;
};

interface CaptiveTraversalWorkspace {
	generation: number;
	readonly predecessors: Int32Array;
	readonly visitGenerations: Uint32Array;
}

const startCaptiveTraversal = (
	workspace: CaptiveTraversalWorkspace,
	rootId: number,
): number => {
	if (workspace.generation === 0xffffffff) {
		workspace.visitGenerations.fill(0);
		workspace.generation = 0;
	}
	workspace.generation++;
	workspace.visitGenerations[rootId] = workspace.generation;
	return workspace.generation;
};

const createCaptiveDependencyIssue = (
	graph: RegistrationGraph,
	root: RegistrationNode,
	node: RegistrationNode,
	pathIds: readonly number[],
): ValidationIssue => {
	const path = pathIds.map((id) => graph.nodes[id].key);
	const pathSegments = pathIds.map((id) => pathSegment(graph.nodes[id]));
	return createValidationIssue({
		code: "CAPTIVE_DEPENDENCY",
		dependencyKey: node.key,
		...(node.registrationIndex === undefined
			? {}
			: { dependencyRegistrationIndex: node.registrationIndex }),
		message:
			`${nodeLabel(root)} is a singleton but depends on scoped service '${node.key}' ` +
			`(captive dependency) via ${path.join(" -> ")}: ` +
			`the scoped instance would be captured beyond its scope's lifetime`,
		pathSegments,
		...issueLocation(root),
	});
};

const findCaptiveDependenciesFromRoot = (
	graph: RegistrationGraph,
	canReachScoped: Uint8Array,
	root: RegistrationNode,
	workspace: CaptiveTraversalWorkspace,
): ValidationIssue[] => {
	const issues: ValidationIssue[] = [];
	const visitGeneration = startCaptiveTraversal(workspace, root.id);
	const stack: number[] = [];
	const addTargets = (nodeId: number): void => {
		const targets = graph.edges[nodeId];
		for (let index = targets.length - 1; index >= 0; index--) {
			const targetId = targets[index];
			if (
				workspace.visitGenerations[targetId] === visitGeneration ||
				canReachScoped[targetId] === 0
			) {
				continue;
			}
			workspace.visitGenerations[targetId] = visitGeneration;
			workspace.predecessors[targetId] = nodeId;
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
		if (node.lifetime !== "scoped") {
			addTargets(nodeId);
			continue;
		}

		const pathIds: number[] = [];
		let pathNodeId = nodeId;
		while (pathNodeId !== root.id) {
			pathIds.push(pathNodeId);
			pathNodeId = workspace.predecessors[pathNodeId];
		}
		pathIds.push(root.id);
		pathIds.reverse();
		issues.push(createCaptiveDependencyIssue(graph, root, node, pathIds));
	}

	return issues;
};

const detectCaptiveDependencies = (
	graph: RegistrationGraph,
): ValidationIssue[] => {
	const canReachScoped = findNodesThatReachScoped(graph);
	const workspace: CaptiveTraversalWorkspace = {
		generation: 0,
		predecessors: new Int32Array(graph.nodes.length),
		visitGenerations: new Uint32Array(graph.nodes.length),
	};
	return graph.nodes.flatMap((root) =>
		root.lifetime === "singleton" && canReachScoped[root.id] === 1
			? findCaptiveDependenciesFromRoot(graph, canReachScoped, root, workspace)
			: [],
	);
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
	visited: Uint8Array,
): readonly number[] | undefined => {
	const rootId = lowestNodeId(component);
	const memberIds = new Set(component);
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
	const visited = new Uint8Array(graph.nodes.length);

	return cyclicComponents.flatMap((component) => {
		const rootId = lowestNodeId(component);
		const root = graph.nodes[rootId];
		const cycleIds = findCyclePath(graph, component, visited);
		if (!cycleIds) {
			return [];
		}
		const keyPath = cycleIds.map((nodeId) => graph.nodes[nodeId].key);
		const pathSegments = cycleIds.map((nodeId) =>
			pathSegment(graph.nodes[nodeId]),
		);
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
				pathSegments,
				...issueLocation(root),
			}),
		];
	});
};

/** Creates immutable graph input from mutable registration wrappers. */
export const createRegistrationSnapshots = (
	registrations: ReadonlyMap<string, ServiceWrapper>,
	multiRegistrations: ReadonlyMap<string, readonly ServiceWrapper[]>,
): readonly RegistrationSnapshot[] => {
	const snapshots: RegistrationSnapshot[] = [];
	const addSnapshot = (
		key: string,
		resolver: ServiceWrapper,
		registrationIndex?: number,
	): void => {
		snapshots.push(
			Object.freeze({
				dependencies: Object.freeze([...resolver.getDependencies()]),
				disposed: resolver.isDisposed(),
				key,
				lifetime: resolver.getLifetime(),
				...(registrationIndex === undefined ? {} : { registrationIndex }),
			}),
		);
	};

	registrations.forEach((resolver, key) => {
		addSnapshot(key, resolver);
	});
	multiRegistrations.forEach((resolvers, key) => {
		resolvers.forEach((resolver, registrationIndex) => {
			addSnapshot(key, resolver, registrationIndex);
		});
	});

	return Object.freeze(snapshots);
};

/** Validates every registration snapshot as one explicit graph node. */
export const validateRegistrationGraph = (
	snapshots: readonly RegistrationSnapshot[],
): readonly ValidationIssue[] => {
	const graph = buildRegistrationGraph(snapshots);
	return Object.freeze([
		...validateNodes(graph),
		...detectCaptiveDependencies(graph),
		...detectCircularDependencies(graph),
	]);
};

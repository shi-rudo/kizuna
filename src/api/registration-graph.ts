import type { ServiceWrapper } from "../core/services/service-wrapper.js";
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

	return { nodes, nodesByKey };
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

		const reportedTargets = new Set<number>();
		const visit = (
			node: RegistrationNode,
			path: readonly string[],
			visiting: ReadonlySet<number>,
		): void => {
			const currentPath = [...path, node.key];
			if (node.resolver.getLifetime() === "scoped") {
				if (reportedTargets.has(node.id)) {
					return;
				}
				reportedTargets.add(node.id);
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
							`(captive dependency) via ${currentPath.join(" -> ")}: ` +
							`the scoped instance would be captured beyond its scope's lifetime`,
						path: currentPath,
						...issueLocation(root),
					}),
				);
				return;
			}

			if (visiting.has(node.id)) {
				return;
			}

			const nextVisiting = new Set(visiting);
			nextVisiting.add(node.id);
			for (const dependencyKey of node.resolver.getDependencies()) {
				for (const target of graph.nodesByKey.get(dependencyKey) ?? []) {
					visit(target, currentPath, nextVisiting);
				}
			}
		};

		for (const dependencyKey of root.resolver.getDependencies()) {
			for (const target of graph.nodesByKey.get(dependencyKey) ?? []) {
				visit(target, [root.key], new Set([root.id]));
			}
		}
	}

	return issues;
};

const detectCircularDependencies = (
	graph: RegistrationGraph,
): ValidationIssue[] => {
	const targetsOf = (node: RegistrationNode): RegistrationNode[] => {
		const targets: RegistrationNode[] = [];
		for (const dependencyKey of node.resolver.getDependencies()) {
			targets.push(...(graph.nodesByKey.get(dependencyKey) ?? []));
		}
		return targets;
	};

	let nextIndex = 0;
	const indices = new Map<number, number>();
	const lowLinks = new Map<number, number>();
	const stack: RegistrationNode[] = [];
	const onStack = new Set<number>();
	const components: RegistrationNode[][] = [];

	const connect = (node: RegistrationNode): void => {
		const nodeIndex = nextIndex;
		nextIndex += 1;
		indices.set(node.id, nodeIndex);
		lowLinks.set(node.id, nodeIndex);
		stack.push(node);
		onStack.add(node.id);

		for (const target of targetsOf(node)) {
			if (!indices.has(target.id)) {
				connect(target);
				lowLinks.set(
					node.id,
					Math.min(
						lowLinks.get(node.id) ?? nodeIndex,
						lowLinks.get(target.id) ?? nodeIndex,
					),
				);
			} else if (onStack.has(target.id)) {
				lowLinks.set(
					node.id,
					Math.min(
						lowLinks.get(node.id) ?? nodeIndex,
						indices.get(target.id) ?? nodeIndex,
					),
				);
			}
		}

		if (lowLinks.get(node.id) !== indices.get(node.id)) {
			return;
		}

		const component: RegistrationNode[] = [];
		let member: RegistrationNode | undefined;
		do {
			member = stack.pop();
			if (!member) {
				break;
			}
			onStack.delete(member.id);
			component.push(member);
		} while (member.id !== node.id);
		components.push(component);
	};

	for (const node of graph.nodes) {
		if (!indices.has(node.id)) {
			connect(node);
		}
	}

	const cyclicComponents = components
		.filter((component) => {
			if (component.length > 1) {
				return true;
			}
			const onlyNode = component[0];
			return onlyNode
				? targetsOf(onlyNode).some((target) => target.id === onlyNode.id)
				: false;
		})
		.sort(
			(left, right) =>
				Math.min(...left.map((node) => node.id)) -
				Math.min(...right.map((node) => node.id)),
		);

	return cyclicComponents.flatMap((component) => {
		const root = component.reduce((lowest, node) =>
			node.id < lowest.id ? node : lowest,
		);
		const memberIds = new Set(component.map((node) => node.id));

		const findCycle = (
			node: RegistrationNode,
			path: readonly RegistrationNode[],
			visiting: ReadonlySet<number>,
		): readonly RegistrationNode[] | undefined => {
			for (const target of targetsOf(node)) {
				if (!memberIds.has(target.id)) {
					continue;
				}
				if (target.id === root.id) {
					return [...path, target];
				}
				if (visiting.has(target.id)) {
					continue;
				}
				const nextVisiting = new Set(visiting);
				nextVisiting.add(target.id);
				const cycle = findCycle(target, [...path, target], nextVisiting);
				if (cycle) {
					return cycle;
				}
			}
			return undefined;
		};

		const cycle = findCycle(root, [root], new Set([root.id]));
		if (!cycle) {
			return [];
		}
		const keyPath = cycle.map((node) => node.key);
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

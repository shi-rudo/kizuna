/**
 * Finds strongly connected graph components without recursion.
 *
 * Both edge lists use node indices. `reverseEdges` must contain each edge in
 * the opposite direction. The iterative passes support large service graphs.
 */
export function findStronglyConnectedComponents(
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

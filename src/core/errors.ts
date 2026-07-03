/**
 * Thrown when resolving a service would recurse into a service that is
 * already being resolved (a dependency cycle at resolve time).
 *
 * The full resolution chain is available via {@link CircularDependencyError.chain}
 * and rendered in the message, e.g. `Circular dependency detected: a -> b -> a`.
 */
export class CircularDependencyError extends Error {
	/** The resolution chain that closed the cycle, ending with the repeated key. */
	public readonly chain: readonly string[];

	constructor(chain: readonly string[]) {
		super(`Circular dependency detected: ${chain.join(" -> ")}`);
		this.name = "CircularDependencyError";
		this.chain = chain;
	}
}

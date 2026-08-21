import type { ServiceLifetime } from "./contracts.js";

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

/** The cleanup operation that produced a disposal failure. */
export type DisposalOperation = "dispose" | "disposeAsync";

/** Structured context for one service cleanup failure. */
export interface DisposalFailure {
	readonly serviceKey: string;
	readonly lifetime: ServiceLifetime;
	readonly operation: DisposalOperation;
	readonly error: unknown;
}

/**
 * Reports one or more failures that occurred while services were disposed.
 * The original failures are available through the inherited `errors` property.
 * This error does not represent a domain aggregate.
 */
export class DisposalError extends AggregateError {
	declare readonly errors: unknown[];
	/** Structured service context for errors raised by container disposal. */
	public readonly failures: readonly DisposalFailure[];

	constructor(
		errors: Iterable<unknown>,
		message = "One or more services failed to dispose",
		failures: readonly DisposalFailure[] = [],
	) {
		super(errors, message);
		this.name = "DisposalError";
		this.failures = Object.freeze([...failures]);
	}
}

import { CircularDependencyError } from "../core/errors.js";

/**
 * A stack with more keys than this keeps a set of its keys. Up to this size, a
 * linear scan costs less than updating a set at every step: a set for every
 * resolution made shallow resolution about twice as slow in the benchmarks.
 */
const indexThreshold = 16;

/**
 * The keys that one container is resolving, in resolution order. It runs each
 * resolution step and reveals a dependency cycle when a key is already being
 * resolved.
 *
 * A stack of up to 16 keys uses a linear scan, the fastest check for the
 * common shallow resolution. A deeper stack keeps a set of its keys, so a
 * chain of depth d does not cost O(d²) comparisons. The set exists only while
 * the stack is deeper than 16 keys.
 *
 * {@link track} does the check, the push, and the pop in one call. It runs on
 * every `get()`, and three separate calls made a warm resolution about 20 %
 * slower in the benchmarks. A step on a shallow stack does nothing beyond the
 * linear scan and one length check; only a step past 16 keys calls into the
 * set.
 *
 * @internal
 */
export class ResolutionStack {
	private readonly keys: string[] = [];
	private index: Set<string> | undefined;

	/**
	 * A live view of the keys in resolution order, the current key last. It
	 * changes with every resolution step, so copy it before you keep it.
	 */
	get path(): readonly string[] {
		return this.keys;
	}

	/**
	 * Runs `resolve` with `key` on the stack and takes the key off again, also
	 * when `resolve` throws. Resolving the key again while it is on the stack,
	 * directly or through dependencies and factories, throws a
	 * {@link CircularDependencyError} instead of recursing until the call stack
	 * overflows.
	 */
	track<T>(key: string, resolve: () => T): T {
		const keys = this.keys;
		if (keys.length >= indexThreshold) {
			return this.trackIndexed(key, resolve);
		}
		if (keys.includes(key)) {
			throw new CircularDependencyError([...keys, key]);
		}
		keys.push(key);
		try {
			return resolve();
		} finally {
			keys.pop();
		}
	}

	/**
	 * A step that makes the stack deeper than 16 keys. The set answers the
	 * check. The first such step builds it, and the step that brings the stack
	 * back to 16 keys drops it.
	 */
	private trackIndexed<T>(key: string, resolve: () => T): T {
		const keys = this.keys;
		const index = this.index ?? new Set(keys);
		if (index.has(key)) {
			throw new CircularDependencyError([...keys, key]);
		}
		keys.push(key);
		index.add(key);
		this.index = index;
		try {
			return resolve();
		} finally {
			keys.pop();
			if (keys.length > indexThreshold) {
				index.delete(key);
			} else {
				this.index = undefined;
			}
		}
	}
}

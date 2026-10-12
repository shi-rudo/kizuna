/**
 * A stack with more keys than this keeps a set of its keys. Up to this size, a
 * linear scan costs less than updating a set at every step: a set for every
 * resolution made shallow resolution about twice as slow in the benchmarks.
 */
const indexThreshold = 16;

/**
 * The keys that one container is resolving, in resolution order. It tells
 * whether a key is already being resolved, which reveals a dependency cycle.
 *
 * A stack of up to 16 keys uses a linear scan, the fastest check for the
 * common shallow resolution. A deeper stack keeps a set of its keys, so a
 * chain of depth d does not cost O(d²) comparisons. The set exists only while
 * the stack is deeper than 16 keys.
 *
 * @internal
 */
export class ResolutionStack {
	private readonly keys: string[] = [];
	private index: Set<string> | undefined;

	/**
	 * A live view of the keys in resolution order, the current key last. It
	 * changes with every push and pop, so copy it before you keep it.
	 */
	get path(): readonly string[] {
		return this.keys;
	}

	includes(key: string): boolean {
		return this.index ? this.index.has(key) : this.keys.includes(key);
	}

	push(key: string): void {
		this.keys.push(key);
		if (this.index) {
			this.index.add(key);
		} else if (this.keys.length > indexThreshold) {
			this.index = new Set(this.keys);
		}
	}

	pop(): void {
		const key = this.keys.pop();
		if (!this.index || key === undefined) {
			return;
		}
		if (this.keys.length > indexThreshold) {
			this.index.delete(key);
		} else {
			this.index = undefined;
		}
	}
}

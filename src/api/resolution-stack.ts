/** The depth from which a set answers whether a key is on the stack. */
const indexThreshold = 16;

/**
 * The keys that one container is resolving, in resolution order. It tells
 * whether a key is already being resolved, which reveals a dependency cycle.
 *
 * A short stack uses a linear scan, the fastest check for the common shallow
 * resolution. A deeper stack keeps a set of its keys, so a chain of depth d
 * does not cost O(d²) comparisons. The set exists only until the stack is
 * empty again.
 *
 * @internal
 */
export class ResolutionStack {
	private readonly keys: string[] = [];
	private index: Set<string> | undefined;

	/** The keys in resolution order, the current key last. */
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
		if (this.index && key !== undefined) {
			this.index.delete(key);
			if (this.keys.length === 0) {
				this.index = undefined;
			}
		}
	}
}

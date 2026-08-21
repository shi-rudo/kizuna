import type {
	BorrowedSingletonReference,
	ServiceLifecycle,
} from "../contracts.js";

/**
 * Resolves a singleton from another container without owning its value.
 * The source container remains responsible for service cleanup.
 */
export class BorrowedSingletonLifecycle implements ServiceLifecycle {
	readonly lifetime = "singleton" as const;
	readonly valueOwnership = "borrowed" as const;
	private reference: BorrowedSingletonReference | null;

	constructor(reference: BorrowedSingletonReference) {
		this.reference = reference;
	}

	getInstance<T>(): T {
		if (!this.reference) {
			throw new Error("Cannot resolve from a disposed borrowed singleton");
		}
		return this.reference.resolve() as T;
	}

	createScope(): ServiceLifecycle {
		return this;
	}

	dispose(): void {
		this.reference = null;
	}

	async disposeAsync(): Promise<void> {
		this.dispose();
	}
}

import type {
	BorrowedSingletonReference,
	ServiceLifecycle,
} from "../contracts.js";
import { ContainerDisposedError } from "../errors.js";

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
			throw new ContainerDisposedError(
				"Cannot resolve from a disposed borrowed singleton",
			);
		}
		return this.reference.resolve() as T;
	}

	createScope(): ServiceLifecycle {
		return this;
	}

	/**
	 * Stops new resolutions before the borrower starts its cleanup. The source
	 * container still owns the value, so there is nothing to clean up here.
	 */
	close(): void {
		this.reference = null;
	}

	dispose(): void {
		this.reference = null;
	}

	async disposeAsync(): Promise<void> {
		this.dispose();
	}
}

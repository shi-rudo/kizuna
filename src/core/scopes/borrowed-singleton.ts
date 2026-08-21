import type { ServiceLifecycle } from "../contracts";

interface BorrowedServiceSource {
	get(key: any): unknown;
}

/**
 * Resolves a singleton from another container without owning its value.
 * The source container remains responsible for service cleanup.
 */
export class BorrowedSingletonLifecycle implements ServiceLifecycle {
	private source: BorrowedServiceSource | null;

	constructor(
		source: BorrowedServiceSource,
		private readonly key: string,
	) {
		this.source = source;
	}

	getInstance<T>(): T {
		if (!this.source) {
			throw new Error("Cannot resolve from a disposed borrowed singleton");
		}
		return this.source.get(this.key) as T;
	}

	setFactory(): void {
		throw new Error("A borrowed singleton does not accept a factory");
	}

	createScope(): ServiceLifecycle {
		return this;
	}

	dispose(): void {
		this.source = null;
	}

	async disposeAsync(): Promise<void> {
		this.dispose();
	}
}

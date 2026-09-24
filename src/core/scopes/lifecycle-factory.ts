import type { DisposalMode, ServiceLifetime } from "../contracts.js";
import { ContainerDisposedError } from "../errors.js";

/** A registered function that creates one service value. */
export type ValueFactory = (...args: any[]) => any;

/**
 * Holds the factory of one lifecycle and whether the lifecycle is open,
 * closed, or disposed.
 *
 * Singleton, scoped, and transient lifecycles use it by composition. It
 * validates a new factory, rejects resolution once the owning container
 * closes the lifecycle, and hands the factory to the lifecycle of a new scope.
 *
 * @internal
 */
export class LifecycleFactory {
	private readonly _lifetime: ServiceLifetime;
	private _factory: ValueFactory | null = null;
	/** Set once the owning container starts its disposal. */
	private _closedBy: DisposalMode | null = null;
	private _isDisposed = false;

	constructor(lifetime: ServiceLifetime) {
		this._lifetime = lifetime;
	}

	/** The disposal path that closed the lifecycle, or null while it is open. */
	public get closedBy(): DisposalMode | null {
		return this._closedBy;
	}

	public get isDisposed(): boolean {
		return this._isDisposed;
	}

	/**
	 * @throws {Error} If the lifecycle is disposed or the factory is not a function
	 */
	public set(factory: ValueFactory): void {
		if (this._isDisposed) {
			throw new Error(
				`Cannot set factory on a disposed ${this._lifetime} lifecycle`,
			);
		}
		if (!factory || typeof factory !== "function") {
			throw new Error("Factory must be a valid function");
		}
		this._factory = factory;
	}

	/**
	 * Stops new resolutions. The owning container calls this method before it
	 * starts any cleanup. The first disposal path that closes it is kept.
	 */
	public close(mode: DisposalMode): void {
		this._closedBy ??= mode;
	}

	/** Closes the lifecycle for good and releases the factory. */
	public dispose(mode: DisposalMode): void {
		this._isDisposed = true;
		this.close(mode);
		this._factory = null;
	}

	/** @throws {ContainerDisposedError} Once the lifecycle is closed */
	public assertOpen(): void {
		if (this._closedBy) {
			throw this.disposedError();
		}
	}

	/** Returns the factory of an open lifecycle. */
	public require(): ValueFactory {
		this.assertOpen();
		if (!this._factory) {
			throw new Error("No factory registered for this lifecycle");
		}
		return this._factory;
	}

	/**
	 * Returns the factory for the lifecycle of a new scope.
	 * @throws {Error} If this lifecycle is disposed or has no factory
	 */
	public forNewScope(): ValueFactory {
		if (this._isDisposed) {
			throw new Error("Cannot create new scope from disposed lifecycle");
		}
		if (!this._factory) {
			throw new Error("No factory available to create new scope");
		}
		return this._factory;
	}

	/** Returns the error for a resolution after the close. */
	public disposedError(options?: ErrorOptions): ContainerDisposedError {
		return new ContainerDisposedError(
			`Cannot resolve from a disposed ${this._lifetime} lifecycle`,
			options,
		);
	}
}

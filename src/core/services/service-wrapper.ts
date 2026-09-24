import type {
	DisposalMode,
	InstanceRequest,
	ServiceLifecycle,
	ServiceLifetime,
	ServiceValueOwnership,
} from "../contracts.js";
import type { DiagnosticsReporter } from "../diagnostics.js";
import { ContainerDisposedError, type DisposalOperation } from "../errors.js";

/**
 * Resolves one declared constructor dependency. A key with multiple
 * registrations resolves to all of its services.
 * @internal
 */
export const resolveDependency: unique symbol = Symbol(
	"kizuna.resolveDependency",
);

/**
 * Reports that the lifecycle of a service created a value during a resolution.
 * @internal
 */
export const reportValueCreated: unique symbol = Symbol(
	"kizuna.reportValueCreated",
);

/** The container that resolves a service: its dependencies and its creations. */
interface ServiceResolver {
	[resolveDependency](key: string): unknown;
	[reportValueCreated](service: ServiceWrapper): void;
}

/**
 * The request that a service passes to its lifecycle for one resolution. It
 * resolves the factory arguments through the resolving container and reports
 * a created value to it.
 */
class ResolutionRequest implements InstanceRequest {
	constructor(
		private readonly service: ServiceWrapper,
		private readonly container: ServiceResolver,
	) {}

	/**
	 * Returns the container for a factory registration, or the resolved
	 * dependencies for a constructor.
	 */
	factoryArguments(): readonly unknown[] {
		if (!this.service.isConstructorBased()) {
			return [this.container];
		}
		return this.service
			.getDependencies()
			.map((dependency) => this.container[resolveDependency](dependency));
	}

	valueCreated(): void {
		this.container[reportValueCreated](this.service);
	}
}

/**
 * Wraps a service with its scope, dependencies, and lifecycle management.
 */
export class ServiceWrapper {
	private readonly _name: string;
	private _lifecycle: ServiceLifecycle | null;
	private _dependencies: readonly string[];
	private _constructorFn?: new (
		...args: any[]
	) => any;
	private _ownsLifecycle: boolean;
	private readonly _lifetime: ServiceLifetime;
	private readonly _valueOwnership: ServiceValueOwnership;

	constructor(
		name: string,
		lifecycle: ServiceLifecycle,
		dependencies: string[],
		constructorFn?: new (...args: any[]) => any,
		ownsLifecycle = true,
	) {
		this._name = name;
		this._lifecycle = lifecycle;
		this._dependencies = Object.freeze([...dependencies]); // Immutable copy
		this._constructorFn = constructorFn;
		this._ownsLifecycle = ownsLifecycle;
		this._lifetime = lifecycle.lifetime;
		this._valueOwnership = lifecycle.valueOwnership;
	}

	/**
	 * Resolves the service instance with its dependencies.
	 * @param container The container or scope that resolves dependencies and
	 * receives each created value
	 * @returns The resolved service instance
	 */
	resolve(container: ServiceResolver): any {
		if (!this._lifecycle) {
			throw new ContainerDisposedError(
				`Cannot resolve disposed service '${this._name}'`,
			);
		}

		return this._lifecycle.getInstance(new ResolutionRequest(this, container));
	}

	/**
	 * Gets the service name.
	 * @returns The service name
	 */
	getName(): string {
		return this._name;
	}

	/**
	 * Gets the service dependencies.
	 * @returns Array of dependency names (readonly)
	 */
	getDependencies(): readonly string[] {
		return this._dependencies;
	}

	/**
	 * Creates a new scope for scoped services.
	 * @returns A new ServiceWrapper instance for the new scope
	 */
	createScope(): ServiceWrapper {
		if (!this._lifecycle) {
			throw new Error(
				`Cannot create new scope for disposed service '${this._name}'`,
			);
		}

		const scopedLifecycle = this._lifecycle.createScope();
		const isShared = scopedLifecycle === this._lifecycle;

		return new ServiceWrapper(
			this._name,
			scopedLifecycle,
			[...this._dependencies],
			this._constructorFn,
			!isShared,
		);
	}

	/**
	 * Stops new resolutions of an owned lifecycle before the container starts
	 * its cleanup. A cleanup failure that no caller waits for goes to
	 * `diagnostics`.
	 */
	close(mode: DisposalMode, diagnostics: DiagnosticsReporter): void {
		if (this._lifecycle && this._ownsLifecycle) {
			const operation: DisposalOperation =
				mode === "async" ? "disposeAsync" : "dispose";
			this._lifecycle.close(
				mode,
				diagnostics.unawaitedFailureSink(this, operation),
			);
		}
	}

	/**
	 * Disposes the resolver and its lifecycle.
	 */
	dispose(): void {
		if (this._lifecycle && this._ownsLifecycle) {
			const lifecycle = this._lifecycle;
			this._lifecycle = null;
			lifecycle.dispose();
		}
	}

	/**
	 * Asynchronously disposes the resolver and awaits its lifecycle's async dispose.
	 */
	async disposeAsync(): Promise<void> {
		if (this._lifecycle && this._ownsLifecycle) {
			const lifecycle = this._lifecycle;
			this._lifecycle = null;
			await lifecycle.disposeAsync();
		}
	}

	/**
	 * Checks if the resolver has been disposed.
	 * @returns true if disposed, false otherwise
	 */
	isDisposed(): boolean {
		return this._lifecycle === null;
	}

	/**
	 * Checks if this is a constructor-based registration.
	 * @returns true if constructor-based, false otherwise
	 */
	isConstructorBased(): boolean {
		return this._constructorFn !== undefined;
	}

	/**
	 * Gets the declared lifetime of the lifecycle manager.
	 * @returns The lifetime classification
	 */
	getLifetime(): ServiceLifetime {
		return this._lifetime;
	}

	/** Returns true only when this wrapper owns one local singleton value. */
	ownsSingletonValue(): boolean {
		return (
			this._ownsLifecycle &&
			this._lifetime === "singleton" &&
			this._valueOwnership === "owned"
		);
	}
}

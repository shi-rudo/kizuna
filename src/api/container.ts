import type { DisposalMode } from "../core/contracts.js";
import type {
	DiagnosticContainerKind,
	DiagnosticsReporter,
} from "../core/diagnostics.js";
import {
	CircularDependencyError,
	ContainerDisposedError,
	DisposalError,
	type DisposalFailure,
	type DisposalOperation,
	InvalidServiceKeyError,
	RegistrationKindError,
	ServiceNotRegisteredError,
	ServiceResolutionError,
	SingletonBorrowError,
} from "../core/errors.js";
import {
	type DisposalAttempt,
	disposeByPlan,
	disposeInSequence,
} from "../core/services/disposal-order.js";
import type { ServiceCatalog } from "../core/services/service-catalog.js";
import {
	RootOwnership,
	type ServiceOwnership,
} from "../core/services/service-ownership.js";
import {
	reportValueCreated,
	resolveDependency,
	type ServiceWrapper,
} from "../core/services/service-wrapper.js";
import {
	type BorrowableSingletonSource,
	type BorrowedSingletonReference,
	borrowableSourceCapability,
} from "./borrowed-singleton-capability.js";
import type { ServiceContainer } from "./contracts/interfaces.js";
import type {
	MultiRegistrationKey,
	MultiRegistrationService,
	ServiceRegistry,
	SingleRegistrationKey,
} from "./contracts/types.js";
import type {
	InterfaceToken,
	InterfaceTokenService,
	RegisteredInterfaceToken,
} from "./interface-token.js";
import { ResolutionStack } from "./resolution-stack.js";

export type { DisposalFailure, DisposalOperation } from "../core/errors.js";

export { CircularDependencyError, DisposalError } from "../core/errors.js";

/** Stable identity token that resolves the current container or scope. */
export const ServiceContainerToken: unique symbol = Symbol("ServiceContainer");

/**
 * @deprecated Use {@link ServiceContainerToken}. This alias holds the same
 * symbol and will be removed in a future major version.
 */
export const ServiceProviderToken: typeof ServiceContainerToken =
	ServiceContainerToken;

/**
 * How a container relates to its root, and where it reports diagnostic events.
 * Scopes inherit the reporter of their root.
 * @internal
 */
export interface ContainerContext {
	readonly kind: DiagnosticContainerKind;
	readonly diagnostics: DiagnosticsReporter;
}

/**
 * Runtime container that resolves registered services.
 *
 * `ContainerBuilder.build()` creates the root container. `startScope()`
 * creates a scope with the same registrations. A container takes the service
 * of a registration from its {@link ServiceOwnership} on the first resolution
 * and keeps it for later lookups.
 *
 * @template TRegistry - The service registry type mapping string keys to service types
 */
export class Container<TRegistry extends ServiceRegistry>
	implements ServiceContainer<TRegistry>, BorrowableSingletonSource
{
	private readonly catalog: ServiceCatalog;
	private readonly ownership: ServiceOwnership;
	/** The services of keys with one registration that this container has. */
	private readonly services: ReadonlyMap<string, ServiceWrapper>;
	/** The services of keys with multiple registrations that this container has. */
	private readonly groups: ReadonlyMap<string, readonly ServiceWrapper[]>;
	private readonly kind: DiagnosticContainerKind;
	private readonly diagnostics: DiagnosticsReporter;
	private _disposed = false;

	get [Symbol.toStringTag]():
		| "KizunaRootServiceContainer"
		| "KizunaServiceScope" {
		return this.kind === "root"
			? "KizunaRootServiceContainer"
			: "KizunaServiceScope";
	}

	/**
	 * Keys currently being resolved on this container, in resolution order.
	 * It detects dependency cycles at resolve time (see
	 * {@link CircularDependencyError}) and provides the path of a created value.
	 */
	private readonly _resolution = new ResolutionStack();

	protected constructor(
		catalog: ServiceCatalog,
		ownership: ServiceOwnership,
		context: ContainerContext,
	) {
		this.catalog = catalog;
		this.ownership = ownership;
		this.services = ownership.services;
		this.groups = ownership.groups;
		this.kind = context.kind;
		this.diagnostics = context.diagnostics;
	}

	/** Creates the root container of a catalog. */
	static createRoot<TRootRegistry extends ServiceRegistry>(
		catalog: ServiceCatalog,
		diagnostics: DiagnosticsReporter,
	): Container<TRootRegistry> {
		return new Container<TRootRegistry>(catalog, new RootOwnership(catalog), {
			kind: "root",
			diagnostics,
		});
	}

	/**
	 * Type-safe service resolution with autocompletion and type inference.
	 */
	get<TToken extends InterfaceToken<unknown, string>>(
		token: RegisteredInterfaceToken<TRegistry, TToken>,
	): InterfaceTokenService<TToken>;
	get<K extends SingleRegistrationKey<TRegistry>>(
		key: K extends InterfaceToken<unknown, string> ? never : K,
	): TRegistry[K];
	get(token: typeof ServiceContainerToken): ServiceContainer<TRegistry>;
	get(keyOrType: keyof TRegistry | typeof ServiceContainerToken): unknown {
		this.ensureNotDisposed();

		if (keyOrType === ServiceContainerToken) {
			return this;
		}

		if (typeof keyOrType !== "string") {
			throw new InvalidServiceKeyError(
				keyOrType,
				"Service keys must be strings or ServiceContainerToken",
			);
		}

		return this.resolveSingle(
			keyOrType,
			this.services.get(keyOrType) ?? this.obtainSingle(keyOrType),
		);
	}

	getAll<K extends string & MultiRegistrationKey<TRegistry>>(
		key: K extends InterfaceToken<unknown, string> ? never : K,
	): MultiRegistrationService<TRegistry[K]>[];
	getAll(key: string): unknown[] {
		this.ensureNotDisposed();
		const typeName = String(key);

		return this.resolveMulti(
			typeName,
			this.groups.get(typeName) ?? this.obtainGroup(typeName),
		);
	}

	/**
	 * Resolves one declared constructor dependency. A key with multiple
	 * registrations resolves to all of its services.
	 * @internal
	 */
	[resolveDependency](key: string): unknown {
		this.ensureNotDisposed();

		const service = this.services.get(key);
		if (service) {
			return this.resolveSingle(key, service);
		}
		const group = this.groups.get(key);
		if (group) {
			return this.resolveMulti(key, group);
		}
		return this.catalog.groups.has(key)
			? this.resolveMulti(key, this.obtainGroup(key))
			: this.resolveSingle(key, this.obtainSingle(key));
	}

	/**
	 * Reports a value that a lifecycle created during a resolution on this
	 * container.
	 * @internal
	 */
	[reportValueCreated](service: ServiceWrapper): void {
		this.diagnostics.serviceCreated(service, this.kind, this._resolution.path);
	}

	/** Resolves a key with one registration and wraps resolution failures. */
	private resolveSingle(key: string, service: ServiceWrapper): unknown {
		try {
			return this._resolution.track(key, () => service.resolve(this));
		} catch (error) {
			if (this.passesThrough(error)) {
				throw error;
			}
			throw new ServiceResolutionError(key, error);
		}
	}

	/** Takes the service of a key with one registration on its first use. */
	private obtainSingle(key: string): ServiceWrapper {
		const root = this.catalog.singles.get(key);
		if (!root) {
			throw this.catalog.groups.has(key)
				? new RegistrationKindError(key, "multi")
				: new ServiceNotRegisteredError(key);
		}
		return this.ownership.obtainSingle(key, root);
	}

	/** Takes the services of a key with multiple registrations on its first use. */
	private obtainGroup(key: string): readonly ServiceWrapper[] {
		const roots = this.catalog.groups.get(key);
		if (!roots) {
			throw this.catalog.singles.has(key)
				? new RegistrationKindError(key, "single")
				: new ServiceNotRegisteredError(key);
		}
		return this.ownership.obtainGroup(key, roots);
	}

	startScope(): ServiceContainer<TRegistry> {
		this.ensureNotDisposed();

		const scope = new Container<TRegistry>(
			this.catalog,
			this.ownership.forNewScope(),
			{ kind: "scope", diagnostics: this.diagnostics },
		);
		this.diagnostics.scopeStarted();
		return scope;
	}

	/**
	 * Creates a restricted resolver for one directly owned root singleton.
	 * @internal
	 */
	[borrowableSourceCapability](key: string): BorrowedSingletonReference {
		this.ensureNotDisposed();

		if (this.kind !== "root") {
			throw new SingletonBorrowError(
				key,
				"SOURCE_IS_SCOPE",
				`Cannot borrow service '${key}'. The source is a scope. Use the root container that owns the singleton.`,
			);
		}

		if (this.catalog.groups.has(key)) {
			throw new SingletonBorrowError(
				key,
				"MULTI_REGISTRATION",
				`Cannot borrow service '${key}'. Multi-service registrations are not supported.`,
			);
		}

		const registration = this.catalog.singles.get(key);
		if (!registration) {
			throw new SingletonBorrowError(
				key,
				"NOT_REGISTERED",
				`Cannot borrow service '${key}'. The source has no such registration.`,
			);
		}

		const lifetime = registration.getLifetime();
		if (lifetime !== "singleton") {
			throw new SingletonBorrowError(
				key,
				"NOT_SINGLETON",
				`Cannot borrow service '${key}'. The source registration is ${lifetime}. Only singleton registrations can be borrowed.`,
			);
		}

		if (!registration.ownsSingletonValue()) {
			throw new SingletonBorrowError(
				key,
				"NOT_OWNED",
				`Cannot borrow service '${key}'. The source does not own this singleton.`,
			);
		}

		return Object.freeze({
			resolve: () => this.get(key as never),
		});
	}

	/**
	 * Disposes all owned services. Cleanup failures do not stop later cleanup.
	 * After all cleanup completes, this method throws one `DisposalError` that
	 * contains the original failures.
	 */
	dispose(): void {
		if (this._disposed) {
			return;
		}
		this._disposed = true;
		this.closeOwnedLifecycles("sync");

		let failures: readonly DisposalFailure[] = [];
		try {
			failures = this.toDisposalFailures(
				disposeInSequence(this.catalog.disposalSequence(), this.ownership),
				"dispose",
			);
		} finally {
			this.ownership.release();
		}

		this.finishDisposal("sync", failures);
	}

	/**
	 * Asynchronously disposes the container and awaits all service-owned async
	 * cleanup. This includes resolved values from singleton and scoped Promise
	 * factories.
	 *
	 * Independent dispose handlers run in parallel. A dependency starts only
	 * after all of its consumer groups settle. Rejections do not stop other
	 * cleanup. After all cleanup settles, this method throws one
	 * `DisposalError` with the original failures. Idempotent — safe to call
	 * multiple times.
	 */
	async disposeAsync(): Promise<void> {
		if (this._disposed) {
			return;
		}
		this._disposed = true;
		this.closeOwnedLifecycles("async");

		let failures: readonly DisposalFailure[] = [];
		try {
			failures = this.toDisposalFailures(
				await disposeByPlan(this.catalog.disposalPlan(), this.ownership),
				"disposeAsync",
			);
		} finally {
			this.ownership.release();
		}

		this.finishDisposal("async", failures);
	}

	/**
	 * TC39 `using` hook — equivalent to `dispose()`.
	 */
	[Symbol.dispose](): void {
		this.dispose();
	}

	/**
	 * TC39 `await using` hook — equivalent to `disposeAsync()`.
	 */
	async [Symbol.asyncDispose](): Promise<void> {
		await this.disposeAsync();
	}

	/**
	 * Closes every owned lifecycle before any cleanup runs. A factory that
	 * disposes its own container then cannot hand out a value.
	 */
	private closeOwnedLifecycles(mode: DisposalMode): void {
		for (const service of this.ownership.owned()) {
			service.close(mode, this.diagnostics);
		}
	}

	private toDisposalFailures(
		attempts: readonly DisposalAttempt<ServiceWrapper>[],
		operation: DisposalOperation,
	): readonly DisposalFailure[] {
		return attempts.map(({ service, error }) =>
			Object.freeze({
				serviceKey: service.getName(),
				lifetime: service.getLifetime(),
				operation,
				error,
			}),
		);
	}

	/** Reports the finished disposal, then throws its failures. */
	private finishDisposal(
		mode: DisposalMode,
		failures: readonly DisposalFailure[],
	): void {
		this.diagnostics.containerDisposed(this.kind, mode, failures.length);
		if (failures.length > 0) {
			throw new DisposalError(
				failures.map((failure) => failure.error),
				undefined,
				failures,
			);
		}
	}

	private ensureNotDisposed(): void {
		if (this._disposed) {
			throw new ContainerDisposedError();
		}
	}

	private resolveMulti(
		typeName: string,
		resolvers: readonly ServiceWrapper[],
	): any[] {
		try {
			return this._resolution.track(typeName, () =>
				resolvers.map((resolver) => resolver.resolve(this)),
			);
		} catch (error) {
			if (this.passesThrough(error)) {
				throw error;
			}
			throw new ServiceResolutionError(typeName, error, "multi");
		}
	}

	/**
	 * A cycle error keeps its chain unwrapped. A disposal error stays unwrapped
	 * only when this container itself is disposed; otherwise the caller needs
	 * the key of the service that met another disposed container.
	 */
	private passesThrough(error: unknown): boolean {
		return (
			error instanceof CircularDependencyError ||
			(error instanceof ContainerDisposedError && this._disposed)
		);
	}
}

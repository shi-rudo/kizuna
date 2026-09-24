import type { ServiceLifetime } from "./contracts.js";

/**
 * Thrown when resolving a service would recurse into a service that is
 * already being resolved (a dependency cycle at resolve time).
 *
 * The full resolution chain is available via {@link CircularDependencyError.chain}
 * and rendered in the message, e.g. `Circular dependency detected: a -> b -> a`.
 */
export class CircularDependencyError extends Error {
	public readonly code = "CIRCULAR_DEPENDENCY" as const;
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
	public readonly code = "DISPOSAL_FAILED" as const;
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

/**
 * Kind of registration behind a key: one `register*()` registration or
 * multiple `add*()` registrations.
 */
export type RegistrationKind = "single" | "multi";

/** Thrown when `get()` or `getAll()` receives a key without a registration. */
export class ServiceNotRegisteredError extends Error {
	public readonly code = "SERVICE_NOT_REGISTERED" as const;
	/** The key without a registration. */
	public readonly key: string;

	constructor(key: string) {
		super(`No service registered for key: ${key}`);
		this.name = "ServiceNotRegisteredError";
		this.key = key;
	}
}

/**
 * Thrown when `get()` receives a multi-registration key or `getAll()` receives
 * a single registration. The message names the correct method.
 */
export class RegistrationKindError extends Error {
	public readonly code = "REGISTRATION_KIND_MISMATCH" as const;
	/** The key that the wrong method received. */
	public readonly key: string;
	/** The registration kind that the key actually has. */
	public readonly registrationKind: RegistrationKind;

	constructor(key: string, registrationKind: RegistrationKind) {
		super(
			registrationKind === "multi"
				? `Key '${key}' has multiple registrations. Use getAll('${key}') to resolve them.`
				: `Key '${key}' has a single registration. Use get('${key}') to resolve it.`,
		);
		this.name = "RegistrationKindError";
		this.key = key;
		this.registrationKind = registrationKind;
	}
}

/**
 * Thrown when a factory or constructor fails while the container resolves a
 * key. `cause` holds the original error without another wrapper.
 */
export class ServiceResolutionError extends Error {
	public readonly code = "SERVICE_RESOLUTION_FAILED" as const;
	/** The key that failed to resolve. */
	public readonly key: string;

	constructor(
		key: string,
		cause: unknown,
		registrationKind: RegistrationKind = "single",
	) {
		const subject = registrationKind === "multi" ? "multi-service" : "service";
		super(
			`Failed to resolve ${subject} ${key}: ${cause instanceof Error ? cause.message : String(cause)}`,
			{ cause },
		);
		this.name = "ServiceResolutionError";
		this.key = key;
	}
}

/** Thrown when code uses a container or scope after its disposal. */
export class ContainerDisposedError extends Error {
	public readonly code = "CONTAINER_DISPOSED" as const;

	constructor(
		message = "Cannot access services from a disposed container",
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "ContainerDisposedError";
	}
}

/**
 * Thrown when a registration reuses a key. A `register*()` key accepts one
 * registration, and `register*()` and `add*()` cannot share a key.
 */
export class RegistrationConflictError extends Error {
	public readonly code = "REGISTRATION_CONFLICT" as const;
	/** The key that is already registered. */
	public readonly key: string;
	/** The registration kind that the key already has. */
	public readonly existingKind: RegistrationKind;
	/** The registration kind that the rejected call requested. */
	public readonly requestedKind: RegistrationKind;

	constructor(
		key: string,
		existingKind: RegistrationKind,
		requestedKind: RegistrationKind,
	) {
		super(
			existingKind === "multi"
				? `Key '${key}' is already registered as a multi-service. Cannot mix add*() and register*() for the same key.`
				: requestedKind === "multi"
					? `Key '${key}' is already registered as a single service. Cannot mix register*() and add*() for the same key.`
					: `Service '${key}' is already registered. Use a new builder or a different key.`,
		);
		this.name = "RegistrationConflictError";
		this.key = key;
		this.existingKind = existingKind;
		this.requestedKind = requestedKind;
	}
}

/** Thrown when code registers a service after `build()`. */
export class BuilderAlreadyBuiltError extends Error {
	public readonly code = "BUILDER_ALREADY_BUILT" as const;

	constructor() {
		super("Cannot modify ContainerBuilder after it has been built");
		this.name = "BuilderAlreadyBuiltError";
	}
}

/**
 * Thrown when a registration key, a dependency key, or a resolution key is
 * not a valid string key. It extends `TypeError`.
 */
export class InvalidServiceKeyError extends TypeError {
	public readonly code = "INVALID_SERVICE_KEY" as const;
	/** The rejected key value. */
	public readonly key: unknown;

	constructor(key: unknown, message: string) {
		super(message);
		this.name = "InvalidServiceKeyError";
		this.key = key;
	}
}

/** `build()` received an option value that it does not support. */
export class InvalidBuildOptionsError extends TypeError {
	public readonly code = "INVALID_BUILD_OPTIONS" as const;
	/** The path of the rejected option, for example `diagnostics.level`. */
	public readonly option: string;
	/** The rejected value. */
	public readonly value: unknown;

	constructor(option: string, value: unknown, message: string) {
		super(message);
		this.name = "InvalidBuildOptionsError";
		this.option = option;
		this.value = value;
	}
}

/** The reason why `borrowSingletonFrom()` rejected a borrow. */
export type SingletonBorrowFailureReason =
	| "INCOMPATIBLE_SOURCE"
	| "INVALID_REFERENCE"
	| "SOURCE_IS_SCOPE"
	| "MULTI_REGISTRATION"
	| "NOT_REGISTERED"
	| "NOT_SINGLETON"
	| "NOT_OWNED";

/** Thrown when `borrowSingletonFrom()` cannot borrow a singleton. */
export class SingletonBorrowError extends Error {
	public readonly code = "SINGLETON_BORROW_FAILED" as const;
	/** The key that the borrower requested. */
	public readonly key: string;
	/** The reason for the rejection. */
	public readonly reason: SingletonBorrowFailureReason;

	constructor(
		key: string,
		reason: SingletonBorrowFailureReason,
		message: string,
	) {
		super(message);
		this.name = "SingletonBorrowError";
		this.key = key;
		this.reason = reason;
	}
}

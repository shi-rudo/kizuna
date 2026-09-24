import type {
	DisposalMode,
	ServiceLifetime,
	ValidationMode,
} from "./contracts.js";
import type { DisposalOperation } from "./errors.js";

/**
 * Severity of a diagnostic event. The names match common logger methods, so a
 * listener can call `logger[event.level](event, event.message)`.
 */
export type DiagnosticLevel = "error" | "debug";

/** The container that reports an event: a root container or one of its scopes. */
export type DiagnosticContainerKind = "root" | "scope";

interface DiagnosticEventBase<
	TCode extends string,
	TLevel extends DiagnosticLevel,
> {
	readonly code: TCode;
	readonly level: TLevel;
	readonly message: string;
}

/** A cleanup that no caller waits for failed, so no other channel reports it. */
export interface UnawaitedCleanupFailedEvent
	extends DiagnosticEventBase<"UNAWAITED_CLEANUP_FAILED", "error"> {
	readonly serviceKey: string;
	readonly lifetime: ServiceLifetime;
	readonly operation: DisposalOperation;
	readonly error: unknown;
}

/** `build()` created a root container. */
export interface ContainerBuiltEvent
	extends DiagnosticEventBase<"CONTAINER_BUILT", "debug"> {
	readonly keyCount: number;
	readonly registrationCount: number;
	readonly validation: ValidationMode;
}

/** `startScope()` created a scope. */
export interface ScopeStartedEvent
	extends DiagnosticEventBase<"SCOPE_STARTED", "debug"> {}

/** A root container or a scope finished its disposal. */
export interface ContainerDisposedEvent
	extends DiagnosticEventBase<"CONTAINER_DISPOSED", "debug"> {
	readonly container: DiagnosticContainerKind;
	readonly mode: DisposalMode;
	readonly failureCount: number;
}

/** A lifecycle created a service value. A cache hit reports nothing. */
export interface ServiceCreatedEvent
	extends DiagnosticEventBase<"SERVICE_CREATED", "debug"> {
	readonly serviceKey: string;
	readonly lifetime: ServiceLifetime;
	readonly container: DiagnosticContainerKind;
	/** The resolution chain of the container that resolved the value. */
	readonly path: readonly string[];
}

/**
 * An event that Kizuna reports to a diagnostics listener. The union is open:
 * later versions can add codes, so a listener ignores codes it does not know.
 */
export type DiagnosticEvent =
	| UnawaitedCleanupFailedEvent
	| ContainerBuiltEvent
	| ScopeStartedEvent
	| ContainerDisposedEvent
	| ServiceCreatedEvent;

/** Receives diagnostic events. Kizuna never writes events to the console. */
export type DiagnosticListener = (event: DiagnosticEvent) => void;

/** The service that an event describes. @internal */
export interface DiagnosticSubject {
	getName(): string;
	getLifetime(): ServiceLifetime;
}

/**
 * Receives what happened inside Kizuna. Only the reporter builds events and
 * applies the level.
 *
 * @internal
 */
export interface DiagnosticsReporter {
	containerBuilt(
		keyCount: number,
		registrationCount: number,
		validation: ValidationMode,
	): void;
	scopeStarted(): void;
	containerDisposed(
		container: DiagnosticContainerKind,
		mode: DisposalMode,
		failureCount: number,
	): void;
	serviceCreated(
		service: DiagnosticSubject,
		container: DiagnosticContainerKind,
		resolutionStack: readonly string[],
	): void;
	unawaitedCleanupFailed(
		service: DiagnosticSubject,
		operation: DisposalOperation,
		error: unknown,
	): void;
}

/** Reports nothing. Used when `build()` receives no diagnostics option. @internal */
export const silentDiagnostics: DiagnosticsReporter = Object.freeze({
	containerBuilt() {},
	scopeStarted() {},
	containerDisposed() {},
	serviceCreated() {},
	unawaitedCleanupFailed() {},
});

/**
 * Creates a reporter that passes events at or above `level` to `listener`. A
 * listener error cannot change the result of a Kizuna operation. It is thrown
 * again in a microtask, like `node:diagnostics_channel` does.
 *
 * @internal
 */
export function createDiagnosticsReporter(
	listener: DiagnosticListener,
	level: DiagnosticLevel,
): DiagnosticsReporter {
	const debugEnabled = level === "debug";
	const deliver = (event: DiagnosticEvent): void => {
		try {
			listener(event);
		} catch (error) {
			queueMicrotask(() => {
				throw error;
			});
		}
	};

	const reporter: DiagnosticsReporter = {
		containerBuilt(keyCount, registrationCount, validation) {
			if (debugEnabled) {
				deliver({
					code: "CONTAINER_BUILT",
					level: "debug",
					message: `Built a container with ${keyCount} keys and ${registrationCount} registrations`,
					keyCount,
					registrationCount,
					validation,
				});
			}
		},
		scopeStarted() {
			if (debugEnabled) {
				deliver({
					code: "SCOPE_STARTED",
					level: "debug",
					message: "Started a scope",
				});
			}
		},
		containerDisposed(container, mode, failureCount) {
			if (debugEnabled) {
				deliver({
					code: "CONTAINER_DISPOSED",
					level: "debug",
					message: `Disposed a ${container} container with ${failureCount} ${failureCount === 1 ? "failure" : "failures"}`,
					container,
					mode,
					failureCount,
				});
			}
		},
		serviceCreated(service, container, resolutionStack) {
			if (debugEnabled) {
				const serviceKey = service.getName();
				deliver({
					code: "SERVICE_CREATED",
					level: "debug",
					message: `Created '${serviceKey}'`,
					serviceKey,
					lifetime: service.getLifetime(),
					container,
					path: Object.freeze([...resolutionStack]),
				});
			}
		},
		unawaitedCleanupFailed(service, operation, error) {
			const serviceKey = service.getName();
			deliver({
				code: "UNAWAITED_CLEANUP_FAILED",
				level: "error",
				message: `Cleanup of '${serviceKey}' failed, and no caller waited for it`,
				serviceKey,
				lifetime: service.getLifetime(),
				operation,
				error,
			});
		},
	};
	return Object.freeze(reporter);
}

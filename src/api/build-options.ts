import { type ValidationMode, validationModes } from "../core/contracts.js";
import {
	createDiagnosticsReporter,
	type DiagnosticLevel,
	type DiagnosticListener,
	type DiagnosticsReporter,
	diagnosticLevels,
	silentDiagnostics,
} from "../core/diagnostics.js";
import { InvalidBuildOptionsError } from "../core/errors.js";

/** Where the container reports diagnostic events, and from which level. */
export interface DiagnosticsOptions {
	/**
	 * Receives each event at or above `level`. Use a logger that exists before
	 * `build()`, and do not resolve services from the container here.
	 */
	readonly listener: DiagnosticListener;
	/**
	 * `error` (the default) delivers only failures that no other channel
	 * reports. `debug` also delivers build, scope, disposal, and creation
	 * events.
	 */
	readonly level?: DiagnosticLevel;
}

/** Options for `ContainerBuilder.build()`. */
export interface ContainerBuildOptions {
	/**
	 * `eager` rejects invalid graphs during `build()`. `deferred` skips static
	 * graph validation. Actual lookup failures then occur during resolution.
	 */
	readonly validation?: ValidationMode;
	/** Reports diagnostic events to a listener. Without it, Kizuna reports nothing. */
	readonly diagnostics?: DiagnosticsOptions;
}

/** The checked build options with their defaults applied. @internal */
export interface ResolvedBuildOptions {
	readonly validation: ValidationMode;
	readonly diagnostics: DiagnosticsReporter;
}

/**
 * Checks the options of `build()` at runtime and applies their defaults.
 * TypeScript rejects these values already. The check protects JavaScript
 * callers and unsafe casts, so it reads every value as `unknown`.
 *
 * @throws {InvalidBuildOptionsError} If an option has an unsupported value
 * @internal
 */
export function resolveBuildOptions(
	options: ContainerBuildOptions,
): ResolvedBuildOptions {
	const received: unknown = options;
	if (!isPlainObject(received)) {
		throw new InvalidBuildOptionsError(
			"options",
			received,
			"Build options must be a plain object.",
		);
	}
	// Only undefined selects a default. null is an unsupported value.
	const validation =
		received.validation === undefined ? "eager" : received.validation;
	if (!isOneOf(validationModes, validation)) {
		throw new InvalidBuildOptionsError(
			"validation",
			received.validation,
			`Build option 'validation' must be ${alternatives(validationModes)}.`,
		);
	}

	return {
		validation,
		diagnostics: diagnosticsReporterFor(received.diagnostics),
	};
}

function diagnosticsReporterFor(options: unknown): DiagnosticsReporter {
	if (options === undefined) {
		return silentDiagnostics;
	}
	if (!isPlainObject(options)) {
		throw new InvalidBuildOptionsError(
			"diagnostics",
			options,
			"Build option 'diagnostics' must be a plain object with a listener.",
		);
	}
	const { listener } = options;
	if (!isListener(listener)) {
		throw new InvalidBuildOptionsError(
			"diagnostics.listener",
			listener,
			"Build option 'diagnostics.listener' must be a function.",
		);
	}
	const level = options.level === undefined ? "error" : options.level;
	if (!isOneOf(diagnosticLevels, level)) {
		throw new InvalidBuildOptionsError(
			"diagnostics.level",
			options.level,
			`Build option 'diagnostics.level' must be ${alternatives(diagnosticLevels)}.`,
		);
	}
	return createDiagnosticsReporter(listener, level);
}

/** True for an object literal or a class instance. Arrays, maps, and null are not. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Object.prototype.toString.call(value) === "[object Object]";
}

function isOneOf<T>(values: readonly T[], value: unknown): value is T {
	return (values as readonly unknown[]).includes(value);
}

function isListener(value: unknown): value is DiagnosticListener {
	return typeof value === "function";
}

/** Lists the allowed values for an error message, for example `'eager' or 'deferred'`. */
function alternatives(values: readonly string[]): string {
	return values.map((value) => `'${value}'`).join(" or ");
}

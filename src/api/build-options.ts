import type { ValidationMode } from "../core/contracts.js";
import {
	createDiagnosticsReporter,
	type DiagnosticLevel,
	type DiagnosticListener,
	type DiagnosticsReporter,
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

const validationModes: readonly unknown[] = ["eager", "deferred"];
const diagnosticLevels: readonly unknown[] = ["error", "debug"];

/**
 * Checks the options of `build()` at runtime and applies their defaults.
 * TypeScript rejects these values already. The check protects JavaScript
 * callers and unsafe casts.
 *
 * @throws {InvalidBuildOptionsError} If an option has an unsupported value
 * @internal
 */
export function resolveBuildOptions(
	options: ContainerBuildOptions,
): ResolvedBuildOptions {
	if (!isObject(options)) {
		throw new InvalidBuildOptionsError(
			"options",
			options,
			"Build options must be an object.",
		);
	}
	// Only undefined selects a default. null is an unsupported value.
	const validation =
		options.validation === undefined ? "eager" : options.validation;
	if (!validationModes.includes(validation)) {
		throw new InvalidBuildOptionsError(
			"validation",
			options.validation,
			"Build option 'validation' must be 'eager' or 'deferred'.",
		);
	}

	return {
		validation,
		diagnostics: diagnosticsReporterFor(options.diagnostics),
	};
}

function isObject(value: unknown): value is object {
	return typeof value === "object" && value !== null;
}

function diagnosticsReporterFor(
	options: DiagnosticsOptions | undefined,
): DiagnosticsReporter {
	if (options === undefined) {
		return silentDiagnostics;
	}
	if (!isObject(options)) {
		throw new InvalidBuildOptionsError(
			"diagnostics",
			options,
			"Build option diagnostics must be an object with a listener.",
		);
	}
	if (typeof options.listener !== "function") {
		throw new InvalidBuildOptionsError(
			"diagnostics.listener",
			options.listener,
			"Build option 'diagnostics.listener' must be a function.",
		);
	}
	const level = options.level === undefined ? "error" : options.level;
	if (!diagnosticLevels.includes(level)) {
		throw new InvalidBuildOptionsError(
			"diagnostics.level",
			options.level,
			"Build option 'diagnostics.level' must be 'error' or 'debug'.",
		);
	}
	return createDiagnosticsReporter(options.listener, level);
}

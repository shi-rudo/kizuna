import {
	createDiagnosticsReporter,
	type DiagnosticLevel,
	type DiagnosticListener,
	type DiagnosticsReporter,
	silentDiagnostics,
} from "../core/diagnostics.js";

/** Where the container reports diagnostic events, and from which level. */
export interface DiagnosticsOptions {
	/** Receives each event at or above `level`. */
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
	readonly validation?: "eager" | "deferred";
	/** Reports diagnostic events to a listener. Without it, Kizuna reports nothing. */
	readonly diagnostics?: DiagnosticsOptions;
}

/** Returns the reporter for the diagnostics option of `build()`. @internal */
export function diagnosticsReporterFor(
	options: DiagnosticsOptions | undefined,
): DiagnosticsReporter {
	return options
		? createDiagnosticsReporter(options.listener, options.level ?? "error")
		: silentDiagnostics;
}

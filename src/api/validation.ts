/** Stable codes for container graph validation issues. */
export type ValidationIssueCode =
	| "INVALID_SERVICE_KEY"
	| "DISPOSED_REGISTRATION"
	| "MISSING_DEPENDENCY"
	| "CAPTIVE_DEPENDENCY"
	| "CIRCULAR_DEPENDENCY";

/** One machine-readable problem in the registered dependency graph. */
export interface ValidationIssue {
	readonly code: ValidationIssueCode;
	readonly message: string;
	readonly serviceKey: string;
	readonly dependencyKey?: string;
	readonly dependencyRegistrationIndex?: number;
	readonly path: readonly string[];
	readonly registrationIndex?: number;
}

/** Controls when the container validates its registered dependency graph. */
export interface ContainerBuildOptions {
	/**
	 * `eager` rejects invalid graphs during `build()`. `deferred` skips static
	 * graph validation. Actual lookup failures then occur during resolution.
	 */
	readonly validation?: "eager" | "deferred";
}

/** Creates one immutable validation issue. */
export const createValidationIssue = (
	issue: ValidationIssue,
): ValidationIssue =>
	Object.freeze({
		...issue,
		path: Object.freeze([...issue.path]),
	});

/** Thrown when a builder contains an invalid dependency graph. */
export class ContainerValidationError extends Error {
	readonly code = "CONTAINER_VALIDATION_FAILED" as const;
	readonly issues: readonly ValidationIssue[];

	constructor(issues: readonly ValidationIssue[]) {
		const immutableIssues = Object.freeze(
			issues.map((issue) => createValidationIssue(issue)),
		);
		const summary = immutableIssues
			.map((issue) => `- [${issue.code}] ${issue.message}`)
			.join("\n");

		super(
			`Container validation failed with ${immutableIssues.length} issue(s)` +
				(summary ? `:\n${summary}` : ""),
		);
		this.name = "ContainerValidationError";
		this.issues = immutableIssues;
	}
}

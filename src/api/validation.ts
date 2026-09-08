/** One key in a validation path, with an index for a multi-registration node. */
export interface ValidationPathSegment {
	readonly key: string;
	readonly registrationIndex?: number;
}

interface ValidationIssueBase {
	readonly message: string;
	readonly serviceKey: string;
	readonly path: readonly string[];
	readonly pathSegments: readonly ValidationPathSegment[];
	readonly registrationIndex?: number;
}

interface InvalidServiceKeyIssue extends ValidationIssueBase {
	readonly code: "INVALID_SERVICE_KEY";
	readonly dependencyKey?: never;
	readonly dependencyRegistrationIndex?: never;
}

interface DisposedRegistrationIssue extends ValidationIssueBase {
	readonly code: "DISPOSED_REGISTRATION";
	readonly dependencyKey?: never;
	readonly dependencyRegistrationIndex?: never;
}

interface MissingDependencyIssue extends ValidationIssueBase {
	readonly code: "MISSING_DEPENDENCY";
	readonly dependencyKey: string;
	readonly dependencyRegistrationIndex?: never;
}

interface CaptiveDependencyIssue extends ValidationIssueBase {
	readonly code: "CAPTIVE_DEPENDENCY";
	readonly dependencyKey: string;
	readonly dependencyRegistrationIndex?: number;
}

interface CircularDependencyIssue extends ValidationIssueBase {
	readonly code: "CIRCULAR_DEPENDENCY";
	readonly dependencyKey: string;
	readonly dependencyRegistrationIndex?: number;
}

/** One machine-readable problem in the registered dependency graph. */
export type ValidationIssue =
	| InvalidServiceKeyIssue
	| DisposedRegistrationIssue
	| MissingDependencyIssue
	| CaptiveDependencyIssue
	| CircularDependencyIssue;

/** Stable codes for container graph validation issues. */
export type ValidationIssueCode = ValidationIssue["code"];

type WithoutPath<T> = T extends unknown ? Omit<T, "path"> : never;
type ValidationIssueInput = WithoutPath<ValidationIssue>;

/** Controls when the container validates its registered dependency graph. */
export interface ContainerBuildOptions {
	/**
	 * `eager` rejects invalid graphs during `build()`. `deferred` skips static
	 * graph validation. Actual lookup failures then occur during resolution.
	 */
	readonly validation?: "eager" | "deferred";

	/**
	 * Maximum number of service cleanup hooks that `disposeAsync()` runs at the
	 * same time. The default is 16. The value must be a positive safe integer.
	 */
	readonly maxAsyncDisposalConcurrency?: number;
}

const DEFAULT_MAX_ASYNC_DISPOSAL_CONCURRENCY = 16;

/** Resolves and validates the graph validation mode. @internal */
export const resolveValidationMode = (
	value: ContainerBuildOptions["validation"],
): "eager" | "deferred" => {
	if (value === undefined || value === "eager") {
		return "eager";
	}
	if (value === "deferred") {
		return "deferred";
	}
	throw new TypeError("validation must be 'eager' or 'deferred'");
};

/** Resolves and validates the async disposal concurrency limit. @internal */
export const resolveMaxAsyncDisposalConcurrency = (
	value: number | undefined,
): number => {
	const resolved = value ?? DEFAULT_MAX_ASYNC_DISPOSAL_CONCURRENCY;
	if (!Number.isSafeInteger(resolved) || resolved < 1) {
		throw new RangeError(
			"maxAsyncDisposalConcurrency must be a positive safe integer",
		);
	}
	return resolved;
};

const toImmutableValidationIssue = (
	issue: ValidationIssueInput | ValidationIssue,
): ValidationIssue => {
	const pathSegments = Object.freeze(
		issue.pathSegments.map((segment) => Object.freeze({ ...segment })),
	);
	return Object.freeze({
		...issue,
		path: Object.freeze(pathSegments.map((segment) => segment.key)),
		pathSegments,
	}) as ValidationIssue;
};

/** Creates one immutable validation issue from structured path data. */
export const createValidationIssue = (
	issue: ValidationIssueInput,
): ValidationIssue => toImmutableValidationIssue(issue);

/** Thrown when a builder contains an invalid dependency graph. */
export class ContainerValidationError extends Error {
	readonly code = "CONTAINER_VALIDATION_FAILED" as const;
	readonly issues: readonly ValidationIssue[];

	constructor(issues: readonly ValidationIssue[]) {
		const immutableIssues = Object.freeze(
			issues.map((issue) => toImmutableValidationIssue(issue)),
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

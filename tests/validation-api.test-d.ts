import {
	ContainerBuilder,
	type ContainerBuildOptions,
	type ValidationIssue,
	type ValidationPathSegment,
} from "../src";

const builder = new ContainerBuilder();
const issues: readonly ValidationIssue[] = builder.validate();
const validIssue = null as unknown as ValidationIssue;

// @ts-expect-error Validation results are immutable.
issues.push(validIssue);

const issue = issues[0];
if (issue) {
	if (issue.code === "MISSING_DEPENDENCY") {
		const dependencyKey: string = issue.dependencyKey;
		void dependencyKey;
	}
	if (issue.code === "INVALID_SERVICE_KEY") {
		const dependencyKey: undefined = issue.dependencyKey;
		void dependencyKey;
	}
	// @ts-expect-error Validation paths are immutable.
	issue.path.push("other");
	const segment: ValidationPathSegment | undefined = issue.pathSegments[0];
	if (segment) {
		const key: string = segment.key;
		void key;
		// @ts-expect-error Validation path segments are immutable.
		segment.key = "other";
	}
	// @ts-expect-error Validation path segment arrays are immutable.
	issue.pathSegments.push({ key: "other" });
}

const deferred: ContainerBuildOptions = { validation: "deferred" };
builder.build(deferred);

// @ts-expect-error The build mode must be eager or deferred.
builder.build({ validation: "disabled" });

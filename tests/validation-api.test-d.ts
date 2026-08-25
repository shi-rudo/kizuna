import {
	ContainerBuilder,
	type ContainerBuildOptions,
	type ValidationIssue,
} from "../src";

const builder = new ContainerBuilder();
const issues: readonly ValidationIssue[] = builder.validate();

// @ts-expect-error Validation results are immutable.
issues.push({});

const issue = issues[0];
if (issue) {
	// @ts-expect-error Validation paths are immutable.
	issue.path.push("other");
}

const deferred: ContainerBuildOptions = { validation: "deferred" };
builder.build(deferred);

// @ts-expect-error The build mode must be eager or deferred.
builder.build({ validation: "disabled" });

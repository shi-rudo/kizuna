import {
	CircularDependencyError,
	ContainerBuilder,
	ContainerValidationError,
} from "@shirudo/kizuna";

try {
	new ContainerBuilder()
		.registerSingletonFactory("consumer", () => ({ value: true }), "missing")
		.build();
	throw new Error("The packed container accepted an invalid graph");
} catch (error) {
	if (!(error instanceof ContainerValidationError)) {
		throw error;
	}
	if (error.issues[0]?.code !== "MISSING_DEPENDENCY") {
		throw new Error("The packed validation error has an unexpected issue code");
	}
	if (error.issues[0]?.pathSegments[0]?.key !== "consumer") {
		throw new Error("The packed validation error has no structured path");
	}
}

try {
	new ContainerBuilder().registerSingletonFactory(
		"invalid",
		() => ({}),
		Symbol("dependency"),
	);
	throw new Error("The packed container accepted an invalid dependency key");
} catch (error) {
	if (
		!(error instanceof TypeError) ||
		error.message !==
			"Dependency at index 0 for service 'invalid' must be a non-empty string"
	) {
		throw error;
	}
}

try {
	new ContainerBuilder()
		.registerSingletonFactory("left", () => ({}), "right")
		.registerSingletonFactory("right", () => ({}), "left")
		.build();
	throw new Error("The packed container accepted a declared dependency cycle");
} catch (error) {
	if (!(error instanceof ContainerValidationError)) {
		throw error;
	}
	const issue = error.issues[0];
	if (issue?.code !== "CIRCULAR_DEPENDENCY") {
		throw new Error("The packed cycle error has an unexpected issue code");
	}
	if (issue.path.join(" -> ") !== "left -> right -> left") {
		throw new Error(`The packed cycle error has the path ${issue.path}`);
	}
}

const undeclaredCycle = new ContainerBuilder()
	.registerSingletonFactory("left", (container) => container.get("right"))
	.registerSingletonFactory("right", (container) => container.get("left"))
	.build();
try {
	undeclaredCycle.get("left");
	throw new Error(
		"The packed container resolved an undeclared dependency cycle",
	);
} catch (error) {
	if (!(error instanceof CircularDependencyError)) {
		throw error;
	}
	if (error.chain.join(" -> ") !== "left -> right -> left") {
		throw new Error(`The packed cycle error has the chain ${error.chain}`);
	}
}

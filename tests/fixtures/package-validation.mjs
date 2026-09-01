import { ContainerBuilder, ContainerValidationError } from "@shirudo/kizuna";

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

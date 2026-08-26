import {
	ContainerBuilder,
	ContainerValidationError,
} from "@shirudo/kizuna";

try {
	new ContainerBuilder()
		.registerSingletonFactory(
			"consumer",
			() => ({ value: true }),
			"missing",
		)
		.build();
	throw new Error("The packed container accepted an invalid graph");
} catch (error) {
	if (!(error instanceof ContainerValidationError)) {
		throw error;
	}
	if (error.issues[0]?.code !== "MISSING_DEPENDENCY") {
		throw new Error("The packed validation error has an unexpected issue code");
	}
}

import { bench, describe } from "vitest";
import {
	consume,
	createMultiResolutionContainer,
	createScopeContainer,
	scenarioSizes,
} from "./scenarios";

describe("scope creation", () => {
	for (const registrationCount of scenarioSizes("start-scope")) {
		const container = createScopeContainer(registrationCount);
		bench(`${registrationCount} registrations`, () => {
			consume(container.startScope());
		});
	}
});

describe("multi-resolution", () => {
	for (const registrationCount of scenarioSizes("get-all")) {
		const container = createMultiResolutionContainer(registrationCount);
		bench(`${registrationCount} registrations`, () => {
			consume(container.getAll("items"));
		});
	}
});

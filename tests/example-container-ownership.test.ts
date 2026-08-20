import { describe, expect, it } from "vitest";
import {
	createOrderDomainContainer,
	createSharedContainer,
	createUserDomainContainer,
} from "../examples/multiple-containers-domain-separation";

describe("the multiple-container example", () => {
	it("leaves disposal of shared services to the shared container", () => {
		const sharedContainer = createSharedContainer();
		const logger = sharedContainer.get("Logger");
		let disposeCalls = 0;
		Object.assign(logger, {
			dispose: () => {
				disposeCalls += 1;
			},
		});

		const userContainer = createUserDomainContainer(sharedContainer);
		const orderContainer = createOrderDomainContainer(sharedContainer);
		userContainer.get("UserService");
		orderContainer.get("OrderService");

		userContainer.dispose();
		orderContainer.dispose();
		const callsAfterDomainDisposal = disposeCalls;
		sharedContainer.dispose();

		expect(callsAfterDomainDisposal).toBe(0);
		expect(disposeCalls).toBe(1);
	});
});

import { describe, expect, it } from "vitest";
import {
	createOrderDomainContainer,
	createSharedContainer,
	createUserDomainContainer,
} from "../examples/multiple-containers-domain-separation";

describe("the multiple-container example", () => {
	it("leaves synchronous disposal of every shared service to the shared container", () => {
		const sharedContainer = createSharedContainer();
		const sharedServices = {
			logger: sharedContainer.get("Logger"),
			email: sharedContainer.get("EmailService"),
			metrics: sharedContainer.get("IMetrics"),
		};
		const disposeCalls = { logger: 0, email: 0, metrics: 0 };
		for (const key of Object.keys(sharedServices) as Array<
			keyof typeof sharedServices
		>) {
			Object.assign(sharedServices[key], {
				dispose: () => {
					disposeCalls[key]++;
				},
			});
		}

		const userContainer = createUserDomainContainer(sharedContainer);
		const orderContainer = createOrderDomainContainer(sharedContainer);
		userContainer.get("UserService");
		userContainer.get("UserNotificationService");
		orderContainer.get("OrderService");
		orderContainer.get("PaymentService");

		userContainer.dispose();
		orderContainer.dispose();
		expect(disposeCalls).toEqual({ logger: 0, email: 0, metrics: 0 });

		sharedContainer.dispose();
		expect(disposeCalls).toEqual({ logger: 1, email: 1, metrics: 1 });
	});

	it("leaves asynchronous disposal of every shared service to the shared container", async () => {
		const sharedContainer = createSharedContainer();
		const sharedServices = {
			logger: sharedContainer.get("Logger"),
			email: sharedContainer.get("EmailService"),
			metrics: sharedContainer.get("IMetrics"),
		};
		const disposeCalls = { logger: 0, email: 0, metrics: 0 };
		for (const key of Object.keys(sharedServices) as Array<
			keyof typeof sharedServices
		>) {
			Object.assign(sharedServices[key], {
				async [Symbol.asyncDispose](): Promise<void> {
					disposeCalls[key]++;
				},
			});
		}

		const userContainer = createUserDomainContainer(sharedContainer);
		const orderContainer = createOrderDomainContainer(sharedContainer);
		userContainer.get("UserService");
		userContainer.get("UserNotificationService");
		orderContainer.get("OrderService");
		orderContainer.get("PaymentService");

		await userContainer.disposeAsync();
		await orderContainer.disposeAsync();
		expect(disposeCalls).toEqual({ logger: 0, email: 0, metrics: 0 });

		await sharedContainer.disposeAsync();
		expect(disposeCalls).toEqual({ logger: 1, email: 1, metrics: 1 });
	});

	it("disposes each domain service before its owned dependency", () => {
		const sharedContainer = createSharedContainer();
		const userContainer = createUserDomainContainer(sharedContainer);
		const orderContainer = createOrderDomainContainer(sharedContainer);
		const events: string[] = [];

		Object.assign(userContainer.get("IUserRepository"), {
			dispose: () => events.push("user-repository"),
		});
		Object.assign(userContainer.get("UserService"), {
			dispose: () => events.push("user-service"),
		});
		Object.assign(orderContainer.get("IOrderRepository"), {
			dispose: () => events.push("order-repository"),
		});
		Object.assign(orderContainer.get("OrderService"), {
			dispose: () => events.push("order-service"),
		});
		Object.assign(orderContainer.get("IPaymentGateway"), {
			dispose: () => events.push("payment-gateway"),
		});
		Object.assign(orderContainer.get("PaymentService"), {
			dispose: () => events.push("payment-service"),
		});

		userContainer.dispose();
		orderContainer.dispose();

		expect(events.indexOf("user-service")).toBeLessThan(
			events.indexOf("user-repository"),
		);
		expect(events.indexOf("order-service")).toBeLessThan(
			events.indexOf("order-repository"),
		);
		expect(events.indexOf("payment-service")).toBeLessThan(
			events.indexOf("payment-gateway"),
		);

		sharedContainer.dispose();
	});
});

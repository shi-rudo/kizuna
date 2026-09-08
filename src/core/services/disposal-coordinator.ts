import type { DisposalFailure, DisposalOperation } from "../errors.js";
import { createAsyncTaskRunner } from "./async-concurrency.js";
import { createDisposalLayers, createDisposalPlan } from "./disposal-order.js";
import type { ServiceWrapper } from "./service-wrapper.js";

/** Coordinates cleanup across one provider registration graph. @internal */
export class DisposalCoordinator {
	private readonly registrationIndices = new Map<ServiceWrapper, number>();

	constructor(
		private readonly registrationOrder: readonly ServiceWrapper[],
		multiRegistrations: ReadonlyMap<string, readonly ServiceWrapper[]>,
		private readonly maxAsyncConcurrency: number,
	) {
		for (const registrations of multiRegistrations.values()) {
			registrations.forEach((registration, index) => {
				this.registrationIndices.set(registration, index);
			});
		}
	}

	dispose(): readonly DisposalFailure[] {
		const failures: DisposalFailure[] = [];
		for (const layer of createDisposalLayers(this.registrationOrder)) {
			for (const registration of layer) {
				try {
					registration.dispose();
				} catch (error) {
					failures.push(
						this.createFailure(registration, "dispose", error),
					);
				}
			}
		}
		return failures;
	}

	async disposeAsync(): Promise<readonly DisposalFailure[]> {
		const plan = createDisposalPlan(this.registrationOrder);
		if (plan.groups.length === 0) {
			return [];
		}

		const failures = new Map<ServiceWrapper, DisposalFailure>();
		const runCleanup = createAsyncTaskRunner(this.maxAsyncConcurrency);
		const remainingConsumers = plan.groups.map(
			(group) => group.consumerGroupCount,
		);

		await new Promise<void>((resolve) => {
			let completedGroups = 0;

			const startGroup = (groupIndex: number): void => {
				const tasks = plan.groups[groupIndex].resolvers.map((registration) =>
					runCleanup(async () => {
						try {
							await registration.disposeAsync();
						} catch (error) {
							failures.set(
								registration,
								this.createFailure(
									registration,
									"disposeAsync",
									error,
								),
							);
						}
					}),
				);

				void Promise.all(tasks).then(() => {
					completedGroups++;

					for (const dependencyGroup of plan.groups[groupIndex]
						.dependencyGroups) {
						remainingConsumers[dependencyGroup]--;
						if (remainingConsumers[dependencyGroup] === 0) {
							startGroup(dependencyGroup);
						}
					}

					if (completedGroups === plan.groups.length) {
						resolve();
					}
				});
			};

			for (const groupIndex of plan.rootGroups) {
				startGroup(groupIndex);
			}
		});

		return this.registrationOrder.flatMap((registration) => {
			const failure = failures.get(registration);
			return failure ? [failure] : [];
		});
	}

	private createFailure(
		registration: ServiceWrapper,
		operation: DisposalOperation,
		error: unknown,
	): DisposalFailure {
		const registrationIndex = this.registrationIndices.get(registration);
		return Object.freeze({
			serviceKey: registration.getName(),
			...(registrationIndex === undefined ? {} : { registrationIndex }),
			lifetime: registration.getLifetime(),
			operation,
			error,
		});
	}
}

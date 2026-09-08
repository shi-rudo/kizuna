import type {
	ConfigurableServiceLifecycle,
	ServiceBuilder,
} from "../core/contracts.js";
import { ServiceWrapper } from "../core/services/service-wrapper.js";
import type {
	Factory,
	ServiceRegistry,
	TypeSafeRegistrar,
} from "./contracts/types.js";

/** Creates internal service wrappers for the type-safe builder. */
export class TypeSafeRegistrarImpl<TRegistry extends ServiceRegistry, T>
	implements TypeSafeRegistrar<TRegistry, T>, ServiceBuilder
{
	private readonly serviceName: string;
	private factory?: (...args: any[]) => any;
	private dependencies: string[] = [];
	private constructorFn?: new (...args: any[]) => T;

	constructor(serviceName: string) {
		this.serviceName = serviceName;
	}

	useType<TCtor extends new (...args: any[]) => T>(
		constructorType: TCtor,
		...dependencies: string[]
	): void {
		const validatedDependencies = this.validateDependencies(dependencies);
		this.constructorFn = constructorType;
		this.dependencies = validatedDependencies;
		this.factory = (...args: any[]) => new constructorType(...args);
	}

	useFactory(factory: Factory<TRegistry, T>, ...dependencies: string[]): void {
		const validatedDependencies = this.validateDependencies(dependencies);
		this.factory = factory;
		this.dependencies = validatedDependencies;
	}

	build(lifecycleManager: ConfigurableServiceLifecycle): ServiceWrapper {
		if (!this.factory) {
			throw new Error(
				`No factory configured for service '${this.serviceName}'`,
			);
		}

		lifecycleManager.setFactory(this.factory);
		return new ServiceWrapper(
			this.serviceName,
			lifecycleManager,
			this.dependencies,
			this.constructorFn,
		);
	}

	private validateDependencies(dependencies: readonly unknown[]): string[] {
		return dependencies.map((dependency, index) => {
			if (typeof dependency !== "string" || dependency.trim() === "") {
				throw new TypeError(
					`Dependency at index ${index} for service '${String(this.serviceName)}' must be a non-empty string`,
				);
			}
			return dependency;
		});
	}
}

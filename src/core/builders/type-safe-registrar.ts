import type {
    Factory,
    ServiceRegistry,
    TypeSafeRegistrar,
} from "../../api/contracts/types.js";
import type {
	ConfigurableServiceLifecycle,
	ServiceBuilder,
} from "../contracts.js";
import { ServiceWrapper } from "../services/service-wrapper.js";

/**
 * Implementation of TypeSafeRegistrar that creates ServiceWrapper instances.
 * This replaces the complex ServiceBuilderFactory for the new type-safe API.
 */
export class TypeSafeRegistrarImpl<TRegistry extends ServiceRegistry, T>
    implements TypeSafeRegistrar<TRegistry, T>, ServiceBuilder {
    private serviceName: string;
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
        this.constructorFn = constructorType;
        this.dependencies = dependencies;
        this.factory = (...args: any[]) => new constructorType(...args);
    }

    useFactory(factory: Factory<TRegistry, T>): void {
        this.factory = factory;
        this.dependencies = [];
    }

    getConstructor(): (new (...args: any[]) => T) | undefined {
        return this.constructorFn;
    }

    build(lifecycleManager: ConfigurableServiceLifecycle): ServiceWrapper {
        if (!this.factory) {
            throw new Error(`No factory configured for service '${this.serviceName}'`);
        }

        lifecycleManager.setFactory(this.factory);
        return new ServiceWrapper(this.serviceName, lifecycleManager, this.dependencies, this.constructorFn);
    }
}

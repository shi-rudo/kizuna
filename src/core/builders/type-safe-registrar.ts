import type { Container, ServiceBuilder } from "../../api/contracts/interfaces";
import type { Factory, TypeSafeRegistrar } from "../../api/contracts/types";
import { ServiceWrapper } from "../services/service-wrapper";

/**
 * Implementation of TypeSafeRegistrar that creates ServiceWrapper instances.
 * This replaces the complex ServiceBuilderFactory for the new type-safe API.
 */
export class TypeSafeRegistrarImpl<T> implements TypeSafeRegistrar<T>, ServiceBuilder {
    private serviceName: string;
    private factory?: (...args: any[]) => any;
    private dependencies: string[] = [];

    constructor(serviceName: string) {
        this.serviceName = serviceName;
    }

    useType<TCtor extends new (...args: any[]) => T>(
        constructor: TCtor,
        ...dependencies: string[]
    ): void {
        this.dependencies = dependencies;
        this.factory = (...args: any[]) => {
            if (dependencies.length === 0) {
                return new constructor();
            }
            return new constructor(...args);
        };
    }

    useFactory(factory: Factory<T>): void {
        this.factory = factory;
        this.dependencies = [];
    }

    useInstance(instance: T): void {
        this.factory = () => instance;
        this.dependencies = [];
    }

    build(lifecycleManager: Container): ServiceWrapper {
        if (!this.factory) {
            throw new Error(`No factory configured for service '${this.serviceName}'`);
        }

        lifecycleManager.setFactory(this.factory);
        return new ServiceWrapper(this.serviceName, lifecycleManager, this.dependencies);
    }
}
import type {
    PendingService,
    ServiceRegistration,
} from "../../../api/contracts/interfaces";
import type { Constructor, Factory } from "../../../api/contracts/types";
import { FactoryServiceBuilder } from "./factory-service-builder";
import { TypeServiceBuilder } from "./type-service-builder";

/**
 * Builder for creating named service registrations.
 * Provides methods to configure how a service should be instantiated.
 */
export class NamedServiceBuilder {
    private readonly name: string;

    /**
     * Creates a new named service builder.
     * @param name The name of the service to register
     * @throws {Error} If name is null, undefined, or empty
     */
    constructor(name: string) {
        if (!name || typeof name !== "string" || name.trim() === "") {
            throw new Error("Service name must be a non-empty string");
        }
        this.name = name.trim();
    }

    /**
     * Configure the service to use a factory function for instantiation.
     * @template T The type returned by the factory
     * @param factory The factory function to create service instances
     * @returns A component registration builder
     * @throws {Error} If factory is null, undefined, or not a function
     */
    useFactory<T>(factory: Factory<T>): ServiceRegistration {
        if (!factory || typeof factory !== "function") {
            throw new Error("Factory must be a valid function");
        }
        return new FactoryServiceBuilder(this.name, factory, []);
    }

    /**
     * Configure the service to use a constructor for instantiation.
     * @template T The type of the constructor
     * @param objImplementation The constructor function
     * @returns A pending component that can be configured with dependencies
     * @throws {Error} If objImplementation is null, undefined, or not a constructor
     */
    useType<T extends new (...args: any[]) => any>(
        objImplementation: Constructor<T>,
    ): PendingService {
        if (!objImplementation || typeof objImplementation !== "function") {
            throw new Error("Implementation must be a valid constructor function");
        }
        return TypeServiceBuilder.createBuilder(this.name, objImplementation);
    }
}

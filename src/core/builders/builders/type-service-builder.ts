import type {
    Container,
    PendingService,
    ServiceRegistration,
} from "../../../api/contracts/interfaces";
import type { Constructor } from "../../../api/contracts/types";
import { ServiceWrapper } from "../../../core/services/service-wrapper";
import { FactoryServiceBuilder } from "./factory-service-builder";

/**
 * Builder for services that use constructor functions for instantiation.
 * Provides methods to configure dependencies and build the service wrapper.
 */
export class TypeServiceBuilder implements PendingService {
    private readonly _serviceName: string;
    private readonly _constructorFunc: new (
        ...args: any[]
    ) => any;

    /**
     * Creates a new type service builder.
     * @param serviceName The name of the service
     * @param constructorFunc The constructor function
     * @throws {Error} If parameters are invalid
     */
    private constructor(
        serviceName: string,
        constructorFunc: new (...args: any[]) => any,
    ) {
        if (
            !serviceName ||
            typeof serviceName !== "string" ||
            serviceName.trim() === ""
        ) {
            throw new Error("Service name must be a non-empty string");
        }
        if (!constructorFunc || typeof constructorFunc !== "function") {
            throw new Error("Constructor function must be a valid function");
        }

        this._serviceName = serviceName.trim();
        this._constructorFunc = constructorFunc;
    }

    /**
     * Static factory method to create a type service builder.
     * @template T The constructor type
     * @param serviceName The name of the service
     * @param objImplementation The constructor function
     * @returns A new type service builder instance
     * @throws {Error} If parameters are invalid
     */
    static createBuilder<T extends new (...args: any[]) => any>(
        serviceName: string,
        objImplementation: Constructor<T>,
    ): TypeServiceBuilder {
        if (
            !serviceName ||
            typeof serviceName !== "string" ||
            serviceName.trim() === ""
        ) {
            throw new Error("Service name must be a non-empty string");
        }
        if (!objImplementation || typeof objImplementation !== "function") {
            throw new Error("Implementation must be a valid constructor function");
        }

        return new TypeServiceBuilder(serviceName, objImplementation);
    }

    /**
     * Configure the service with dependencies.
     * @param dependencies Array of dependency names or constructors
     * @returns A component registration with dependencies
     * @throws {Error} If dependencies are invalid
     */
    withDependencies(
        ...dependencies: (string | Constructor<any>)[]
    ): ServiceRegistration {
        if (!Array.isArray(dependencies)) {
            throw new Error("Dependencies must be provided as an array");
        }

        try {
            const dependencyNames = dependencies.map((dependency) => {
                if (typeof dependency === "string") {
                    if (!dependency.trim()) {
                        throw new Error("Dependency name cannot be empty");
                    }
                    return dependency.trim();
                } else if (typeof dependency === "function" && dependency.name) {
                    return dependency.name;
                } else {
                    throw new Error(
                        "Dependency must be a string or constructor with a name",
                    );
                }
            });

            return new FactoryServiceBuilder(
                this._serviceName,
                (...args) => new this._constructorFunc(...args),
                dependencyNames,
            );
        } catch (error) {
            throw new Error(
                `Failed to configure dependencies for service '${this._serviceName}': ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Builds the service wrapper with the configured lifecycle manager.
     * @param lifecycleManager The lifecycle implementation to manage the service
     * @returns A configured service wrapper
     * @throws {Error} If lifecycle manager is invalid or build fails
     */
    public build(lifecycleManager: Container): ServiceWrapper {
        if (!lifecycleManager || typeof lifecycleManager.setFactory !== "function") {
            throw new Error(
                "Lifecycle manager must be a valid container with setFactory method",
            );
        }

        try {
            lifecycleManager.setFactory((...args) => new this._constructorFunc(...args));
            return new ServiceWrapper(this._serviceName, lifecycleManager, []);
        } catch (error) {
            throw new Error(
                `Failed to build service '${this._serviceName}': ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}

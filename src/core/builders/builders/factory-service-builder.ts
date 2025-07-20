import type {
    Container,
    ServiceRegistration,
} from "../../../api/contracts/interfaces";
import { ServiceWrapper } from "../../../core/services/service-wrapper";

/**
 * Builder for services that use factory functions for instantiation.
 * Handles the creation of services with their dependencies and lifecycle management.
 */
export class FactoryServiceBuilder implements ServiceRegistration {
    private readonly _serviceName: string;
    private readonly _factory: (...args: unknown[]) => any;
    private readonly _dependencies: readonly string[];

    /**
     * Creates a new factory service builder.
     * @param serviceName The name of the service
     * @param factory The factory function to create instances
     * @param dependencies Array of dependency names
     * @throws {Error} If any parameter is invalid
     */
    constructor(
        serviceName: string,
        factory: (...args: any[]) => any,
        dependencies: string[],
    ) {
        if (
            !serviceName ||
            typeof serviceName !== "string" ||
            serviceName.trim() === ""
        ) {
            throw new Error("Service name must be a non-empty string");
        }
        if (!factory || typeof factory !== "function") {
            throw new Error("Factory must be a valid function");
        }
        if (!Array.isArray(dependencies)) {
            throw new Error("Dependencies must be an array");
        }

        this._serviceName = serviceName.trim();
        this._factory = factory;
        this._dependencies = Object.freeze([...dependencies]); // Create immutable copy
    }

    /**
     * Builds the service wrapper with the configured lifecycle manager.
     * @param lifecycleManager The lifecycle implementation to manage the service
     * @returns A configured service wrapper
     * @throws {Error} If lifecycle manager is invalid
     */
    public build(lifecycleManager: Container): ServiceWrapper {
        if (!lifecycleManager || typeof lifecycleManager.setFactory !== "function") {
            throw new Error(
                "Lifecycle manager must be a valid container with setFactory method",
            );
        }

        try {
            lifecycleManager.setFactory(this._factory);
            return new ServiceWrapper(this._serviceName, lifecycleManager, [
                ...this._dependencies,
            ]);
        } catch (error) {
            throw new Error(
                `Failed to build service '${this._serviceName}': ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}

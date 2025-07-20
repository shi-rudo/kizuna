import type { PendingService } from "../../api/contracts/interfaces";
import type { Constructor } from "../../api/contracts/types";
import { NamedServiceBuilder } from "./builders/named-service-builder";
import { TypeServiceBuilder } from "./builders/type-service-builder";

/**
 * Factory for creating service builders.
 * Provides methods to start building service registrations by name or type.
 */
export class ServiceBuilderFactory {
    /**
     * Creates a named service builder for services registered by string name.
     * @param serviceName The name of the service to register
     * @returns A builder to configure the service
     * @throws {Error} If serviceName is invalid
     */
    fromName(serviceName: string): NamedServiceBuilder {
        if (!serviceName || typeof serviceName !== "string" || serviceName.trim() === "") {
            throw new Error("Service name must be a non-empty string");
        }
        return new NamedServiceBuilder(serviceName);
    }

    /**
     * Creates a type service builder for services registered by constructor type.
     * @template T The constructor type
     * @param objImplementation The constructor function
     * @returns A builder to configure the service with dependencies
     * @throws {Error} If objImplementation is invalid
     */
    fromType<T extends new (...args: any) => any>(
        objImplementation: Constructor<T>,
    ): PendingService {
        if (!objImplementation || typeof objImplementation !== "function") {
            throw new Error("Implementation must be a valid constructor function");
        }
        if (!objImplementation.name) {
            throw new Error("Constructor function must have a name");
        }
        
        return TypeServiceBuilder.createBuilder(
            objImplementation.name,
            objImplementation,
        );
    }
}

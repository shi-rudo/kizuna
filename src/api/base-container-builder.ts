import type { ServiceWrapper } from "../core/services/service-wrapper.js";
import { validateRegistrationGraph } from "./registration-graph.js";
import type { ValidationIssue } from "./validation.js";

/**
 * Base class for container builders that provides shared functionality
 * for service registration, validation, and lifecycle management.
 * 
 * @internal
 */
export abstract class BaseContainerBuilder {
    protected readonly registrations: Map<string, ServiceWrapper> = new Map();
    protected readonly multiRegistrations: Map<string, ServiceWrapper[]> = new Map();
    protected readonly registrationOrder: ServiceWrapper[] = [];
    protected readonly registrationNames: Set<string> = new Set();
    protected isBuilt: boolean = false;

    /**
     * Checks if a service is registered.
     * @param {string} serviceName - The registered string key
     * @returns {boolean} True if the service is registered, false otherwise
     */
    isRegistered(serviceName: string): boolean {
        return this.registrationNames.has(serviceName);
    }

    /**
     * Gets the number of registered services.
     * @returns {number} The count of registered services
     */
    get count(): number {
        return this.registrationNames.size;
    }

    /**
     * Gets all registered service names.
     * @returns {string[]} Array of registered service names
     */
    getRegisteredServiceNames(): string[] {
        return Array.from(this.registrationNames);
    }

    /**
     * Validates all service registrations for potential issues.
     * @returns Immutable machine-readable validation issues
     */
    validate(): readonly ValidationIssue[] {
        return validateRegistrationGraph(
            this.registrations,
            this.multiRegistrations,
        );
    }

    /**
     * Validates a service name.
     * @protected
     * @param {string} serviceName - The name to validate
     * @throws {Error} If the service name is invalid
     */
    protected validateServiceName(serviceName: string): void {
        this.ensureValidServiceName(serviceName);

        if (this.multiRegistrations.has(serviceName)) {
            throw new Error(
                `Key '${serviceName}' is already registered as a multi-service. ` +
                `Cannot mix add*() and register*() for the same key.`
            );
        }

        if (this.registrationNames.has(serviceName)) {
            throw new Error(
                `Service '${serviceName}' is already registered. Use a new builder or a different key.`,
            );
        }
    }

    /**
     * Ensures a service name is a non-empty string.
     * @private
     * @throws {Error} If the service name is invalid
     */
    private ensureValidServiceName(serviceName: string): void {
        if (
            !serviceName ||
            typeof serviceName !== "string" ||
            serviceName.trim() === ""
        ) {
            throw new Error("Service registration must have a valid name");
        }
    }

    /**
     * Registers a service with the given name and resolver.
     * @protected
     * @param {string} serviceName - The name of the service
     * @param {ServiceWrapper} resolver - The service wrapper
     */
    protected registerService(serviceName: string, resolver: ServiceWrapper): void {
        this.registrations.set(serviceName, resolver);
        this.registrationOrder.push(resolver);
        this.registrationNames.add(serviceName);
    }

    /**
     * Appends a service wrapper to the multi-registration list for the given key.
     * Guards against collision with single-registrations.
     * @protected
     * @param {string} serviceName - The key for the multi-registration
     * @param {ServiceWrapper} resolver - The service wrapper to append
     */
    protected addMultiService(serviceName: string, resolver: ServiceWrapper): void {
        this.ensureValidServiceName(serviceName);

        if (this.registrations.has(serviceName)) {
            throw new Error(
                `Key '${serviceName}' is already registered as a single service. ` +
                `Cannot mix register*() and add*() for the same key.`
            );
        }

        const existing = this.multiRegistrations.get(serviceName);
        if (existing) {
            existing.push(resolver);
        } else {
            this.multiRegistrations.set(serviceName, [resolver]);
        }
        this.registrationOrder.push(resolver);
        this.registrationNames.add(serviceName);
    }

    /**
     * Ensures the builder has not been built yet.
     * @protected
     * @throws {Error} If the builder has already been built
     */
    protected ensureNotBuilt(): void {
        if (this.isBuilt) {
            throw new Error("Cannot modify ContainerBuilder after it has been built");
        }
    }

    /**
     * Marks the builder as built to prevent further modifications.
     * @protected
     */
    protected markAsBuilt(): void {
        this.isBuilt = true;
    }

    /**
     * Environment-agnostic logging methods
     * @protected
     */
    protected logWarning(message: string): void {
        try {
            if (typeof console !== "undefined" && console.warn) {
                console.warn(message);
            }
        } catch {
            // Silently ignore if console is not available
        }
    }

}

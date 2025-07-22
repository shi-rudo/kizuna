import type { ServiceWrapper } from "../core/services/service-wrapper";
import type { Container } from "./contracts/interfaces";

/**
 * Environment detection utility for cross-platform compatibility.
 * Detects development mode across different JavaScript environments (Node.js, browsers, etc.)
 *
 * @returns {boolean} True if running in development mode, false otherwise
 * @internal
 */
const isDevelopment = (): boolean => {
    try {
        // Check for common development indicators across environments
        return (
            (typeof globalThis !== "undefined" &&
                (globalThis as any).__DEV__ === true) ||
            (typeof process !== "undefined" && process.env?.NODE_ENV !== "production")
        );
    } catch {
        return false;
    }
};

/**
 * Base class for container builders that provides shared functionality
 * for service registration, validation, and lifecycle management.
 * 
 * @internal
 */
export abstract class BaseContainerBuilder {
    protected readonly registrations: Map<string, ServiceWrapper> = new Map();
    protected readonly registrationNames: Set<string> = new Set();
    protected isBuilt: boolean = false;
    protected strictParameterValidation: boolean = false;

    /**
     * Creates a new instance of BaseContainerBuilder.
     *
     * @param {unknown} [patch] - Optional patch object for configuration.
     *   If provided, the patch object will be processed to configure function names
     *   for better debugging support in development environments.
     */
    constructor(patch?: unknown) {
        if (patch && typeof patch === "object" && patch !== null) {
            this.patch(patch as Record<string, unknown>);
        }
    }

    /**
     * Checks if a service is registered.
     * @template T - The service type
     * @param {string | T} serviceName - The name of the service or its constructor
     * @returns {boolean} True if the service is registered, false otherwise
     */
    isRegistered<T extends new (...args: any[]) => any>(
        serviceName: string | T,
    ): boolean {
        const name =
            typeof serviceName === "string" ? serviceName : serviceName.name;
        return this.registrationNames.has(name);
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
     * Enables strict parameter name validation for constructor-based registrations.
     * When enabled, validation will check that dependency names match constructor parameter names.
     * @returns {this} The container builder for method chaining
     */
    enableStrictParameterValidation(): this {
        this.strictParameterValidation = true;
        return this;
    }

    /**
     * Removes a service registration.
     * @template T - The service type
     * @param {string | T} serviceName - The name of the service or its constructor
     * @returns {boolean} True if the service was removed, false if it wasn't registered
     */
    remove<T extends new (...args: any[]) => any>(
        serviceName: string | T,
    ): boolean {
        this.ensureNotBuilt();

        const name =
            typeof serviceName === "string" ? serviceName : serviceName.name;

        if (!this.registrationNames.has(name)) {
            return false;
        }

        try {
            const resolver = this.registrations.get(name);
            resolver?.dispose?.();

            this.registrations.delete(name);
            this.registrationNames.delete(name);
            return true;
        } catch (error) {
            this.logError(`Error removing service '${name}':`, error);
            return false;
        }
    }

    /**
     * Clears all service registrations.
     * @throws {Error} If the service collection has already been built
     */
    clear(): void {
        this.ensureNotBuilt();

        // Dispose of all resolvers
        this.registrations.forEach((resolver) => {
            try {
                resolver.dispose?.();
            } catch (error) {
                this.logError("Error disposing resolver:", error);
            }
        });

        this.registrations.clear();
        this.registrationNames.clear();
    }

    /**
     * Validates all service registrations for potential issues.
     * @returns {string[]} Array of validation warnings/errors
     */
    validate(): string[] {
        const issues: string[] = [];

        // Basic validation of service registrations
        this.registrations.forEach((resolver, name) => {
            if (!name || typeof name !== "string" || name.trim() === "") {
                issues.push("Service registration has empty or invalid name");
                return;
            }

            if (resolver.isDisposed()) {
                issues.push(`Service '${name}' has been disposed`);
                return;
            }

            // Validate dependencies exist
            const dependencies = resolver.getDependencies();
            dependencies.forEach((dep) => {
                if (!this.isRegistered(dep)) {
                    issues.push(
                        `Service '${name}' depends on unregistered service '${dep}'`,
                    );
                }
            });

            // Validate parameter names match dependencies for constructor-based registrations
            if (resolver.isConstructorBased()) {
                const constructor = resolver.getConstructor();
                if (constructor) {
                    const paramNames = this.extractParameterNames(constructor);
                    const deps = resolver.getDependencies();
                    
                    // Only validate if we have both parameters and dependencies
                    // and parameter names were successfully extracted
                    if (paramNames.length > 0 && deps.length > 0 && paramNames.length >= deps.length) {
                        deps.forEach((depName, index) => {
                            const paramName = paramNames[index];
                            if (paramName && depName !== paramName) {
                                issues.push(
                                    `Service '${name}' parameter ${index} is named '${paramName}' but dependency '${depName}' is provided. ` +
                                    `Consider: .registerSingleton('${name}', ${constructor.name}, ${paramNames.map(p => `'${p}'`).join(', ')})`
                                );
                            }
                        });
                    }
                }
            }
        });

        // Check for circular dependencies
        const circularDependencies = this.detectCircularDependencies();
        issues.push(...circularDependencies);

        return issues;
    }

    /**
     * Validates a service name.
     * @protected
     * @param {string} serviceName - The name to validate
     * @throws {Error} If the service name is invalid
     */
    protected validateServiceName(serviceName: string): void {
        if (
            !serviceName ||
            typeof serviceName !== "string" ||
            serviceName.trim() === ""
        ) {
            throw new Error("Service registration must have a valid name");
        }

        if (this.registrationNames.has(serviceName)) {
            this.logWarning(
                `Service '${serviceName}' is already registered. Overwriting existing registration.`,
            );
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
     * Detects circular dependencies in the service registrations.
     * @private
     * @returns Array of circular dependency error messages
     */
    private detectCircularDependencies(): string[] {
        const issues: string[] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        // Build dependency graph
        const dependencyGraph = new Map<string, string[]>();
        this.registrations.forEach((resolver, name) => {
            dependencyGraph.set(name, [...resolver.getDependencies()]);
        });

        // Depth-first search to detect cycles
        const hasCycle = (serviceName: string, path: string[]): boolean => {
            if (recursionStack.has(serviceName)) {
                // Found a cycle
                const cycleStart = path.indexOf(serviceName);
                const cycle = [...path.slice(cycleStart), serviceName];
                issues.push(`Circular dependency detected: ${cycle.join(" -> ")}`);
                return true;
            }

            if (visited.has(serviceName)) {
                return false; // Already processed this path
            }

            visited.add(serviceName);
            recursionStack.add(serviceName);

            const dependencies = dependencyGraph.get(serviceName) || [];
            for (const dependency of dependencies) {
                if (dependencyGraph.has(dependency)) {
                    if (hasCycle(dependency, [...path, serviceName])) {
                        return true;
                    }
                }
            }

            recursionStack.delete(serviceName);
            return false;
        };

        // Check each service for cycles
        dependencyGraph.forEach((_, serviceName) => {
            if (!visited.has(serviceName)) {
                hasCycle(serviceName, []);
            }
        });

        return issues;
    }

    /**
     * Helper function to check if a value is a plain object
     * @private
     */
    private isPlainObject(obj: unknown): obj is Record<string, unknown> {
        return (
            obj !== null &&
            typeof obj === "object" &&
            Object.prototype.toString.call(obj) === "[object Object]" &&
            Object.getPrototypeOf(obj) === Object.prototype
        );
    }

    /**
     * Sets the display name of a function for better debugging.
     * @private
     * @param {Function} fn - The function to name
     * @param {string} name - The name to set
     */
    private setFunctionName(fn: Function, name: string): void {
        if (typeof fn !== "function" || !name) {
            return;
        }

        try {
            // Try to set the display name if the environment supports it
            if ("displayName" in fn) {
                (fn as { displayName?: string }).displayName = name;
            }

            // Set the name property if configurable
            try {
                Object.defineProperty(fn, "name", {
                    value: name,
                    configurable: true,
                });
            } catch (_) {
                // In some environments, the name property might not be configurable
                if (isDevelopment()) {
                    this.logWarning(`Could not set name for function: ${name}`);
                }
            }
        } catch (error) {
            if (isDevelopment()) {
                this.logError(`Error setting function name for ${name}:`, error);
            }
        }
    }

    /**
     * Patches the service collection with functions from the provided namespace.
     * @private
     * @param {Record<string, unknown>} ns - The namespace object to patch from
     * @param {string} [path] - The current path in the namespace (used for recursion)
     */
    private patch(ns: Record<string, unknown>, path: string = ""): void {
        if (!ns || typeof ns !== "object") {
            return;
        }

        try {
            Object.entries(ns).forEach(([key, value]) => {
                const currentPath = path ? `${path}.${key}` : key;

                try {
                    if (this.isPlainObject(value)) {
                        // Recursively patch plain objects
                        this.patch(value as Record<string, unknown>, currentPath);
                    } else if (typeof value === "function") {
                        // Set function name for functions
                        this.setFunctionName(value, currentPath);
                    }
                } catch (error) {
                    if (isDevelopment()) {
                        this.logError(`Error processing '${currentPath}':`, error);
                    }
                }
            });
        } catch (error) {
            if (isDevelopment()) {
                this.logError("Error during patch operation:", error);
            }
        }
    }

    /**
     * Extracts parameter names from a constructor function.
     * @private
     * @param constructor - The constructor function to analyze
     * @returns Array of parameter names
     */
    private extractParameterNames(constructor: new (...args: any[]) => any): string[] {
        try {
            // Convert constructor to string and extract parameter list
            const constructorStr = constructor.toString();
            
            
            // Match various constructor patterns
            const patterns = [
                /constructor\s*\(([^)]*)\)/, // constructor(params)
                /function\s+\w*\s*\(([^)]*)\)/, // function Name(params)
                /^\s*\(([^)]*)\)\s*=>/, // (params) => 
                /^\s*([^=]*?)\s*=>/ // param => or param1, param2 =>
            ];
            
            let paramString = '';
            for (const pattern of patterns) {
                const match = constructorStr.match(pattern);
                if (match) {
                    paramString = match[1];
                    break;
                }
            }
            
            if (!paramString.trim()) {
                return [];
            }
            
            
            // Split parameters and clean them up
            const result = paramString
                .split(',')
                .map(param => {
                    // Remove TypeScript types, default values, destructuring
                    let cleaned = param
                        .trim()
                        .replace(/:\s*[^=,]+/g, '') // Remove : Type
                        .replace(/\s*=\s*[^,]+/g, '') // Remove = defaultValue
                        .replace(/^(public|private|protected|readonly)\s+/, '') // Remove access modifiers
                        .replace(/\s+/g, ''); // Remove extra spaces
                    
                    // Handle destructuring and rest params
                    if (cleaned.includes('{') || cleaned.includes('[') || cleaned.startsWith('...')) {
                        return '';
                    }
                    
                    return cleaned;
                })
                .filter(name => name && name !== '' && !name.startsWith('{') && !name.startsWith('['))
                .map(name => name.replace(/[^a-zA-Z0-9_$]/g, '')) // Remove special characters
                .filter(name => name.length > 0);
                
            return result;
        } catch (error) {
            // If parsing fails, return empty array - better than crashing
            if (isDevelopment()) {
                this.logWarning(`Failed to extract parameter names from constructor: ${error}`);
            }
            return [];
        }
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

    /**
     * @protected
     */
    protected logError(message: string, error?: unknown): void {
        try {
            if (typeof console !== "undefined" && console.error) {
                console.error(message, error);
            }
        } catch {
            // Silently ignore if console is not available
        }
    }
}
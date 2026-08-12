import type { ServiceWrapper } from "../core/services/service-wrapper";

/**
 * Environment detection utility for cross-platform compatibility.
 * Detects development mode across different JavaScript environments (Node.js, browsers, etc.)
 *
 * @returns {boolean} True if running in development mode, false otherwise
 * @internal
 */
const isDevelopment = (): boolean => {
    try {
        // Check for common development indicators across environments.
        // process is read off globalThis so the source does not depend on
        // Node.js type definitions (the library also targets edge/browser).
        const proc = (globalThis as {
            process?: { env?: Record<string, string | undefined> };
        }).process;
        return (
            (typeof globalThis !== "undefined" &&
                (globalThis as any).__DEV__ === true) ||
            (proc !== undefined && proc.env?.NODE_ENV !== "production")
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
    protected readonly multiRegistrations: Map<string, ServiceWrapper[]> = new Map();
    protected readonly registrationOrder: ServiceWrapper[] = [];
    protected readonly registrationNames: Set<string> = new Set();
    protected isBuilt: boolean = false;
    protected strictParameterValidation: boolean = true;

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
     * Disables strict parameter name validation for constructor-based registrations.
     *
     * By default, `validate()` checks that dependency names match constructor parameter
     * names — but only in development. The check is automatically skipped when
     * `NODE_ENV === "production"` (or when `process` is unavailable, e.g. in edge
     * runtimes) because minification mangles parameter names and the check would
     * produce false positives. Call this method to also opt out in development.
     *
     * @returns {this} The container builder for method chaining
     */
    disableStrictParameterValidation(): this {
        this.strictParameterValidation = false;
        return this;
    }

    /**
     * Validates all service registrations for potential issues.
     * @returns {string[]} Array of validation warnings/errors
     */
    validate(): string[] {
        const issues: string[] = [];
        const strictParamCheckEnabled = this.strictParameterValidation && isDevelopment();

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

            // Validate parameter names match dependencies for constructor-based registrations.
            // Skipped in production builds where minification mangles parameter names — the
            // check would produce false positives (e.g. constructor(a, b) after esbuild).
            if (strictParamCheckEnabled) {
                if (resolver.isConstructorBased()) {
                    const constructorFn = resolver.getConstructor();
                    if (constructorFn) {
                        const paramNames = this.extractParameterNames(constructorFn);
                        const deps = resolver.getDependencies();
                        
                        // Only validate if we have both parameters and dependencies
                        // and parameter names were successfully extracted
                        if (paramNames.length > 0 && deps.length > 0 && paramNames.length >= deps.length) {
                            deps.forEach((depName, index) => {
                                const paramName = paramNames[index];
                                if (paramName && depName !== paramName) {
                                    issues.push(
                                        `Service '${name}' parameter ${index} is named '${paramName}' but dependency '${depName}' is provided. ` +
                                        `Consider: .registerSingleton('${name}', ${constructorFn.name}, ${paramNames.map(p => `'${p}'`).join(', ')})`
                                    );
                                }
                            });
                        }
                    }
                }
            }
        });

        // Validate multi-registrations
        this.multiRegistrations.forEach((resolvers, name) => {
            for (const resolver of resolvers) {
                if (resolver.isDisposed()) {
                    issues.push(`Multi-service '${name}' has a disposed registration`);
                    continue;
                }

                const dependencies = resolver.getDependencies();
                dependencies.forEach((dep) => {
                    if (!this.isRegistered(dep)) {
                        issues.push(
                            `Multi-service '${name}' depends on unregistered service '${dep}'`,
                        );
                    }
                });

            }
        });

        issues.push(...this.detectCaptiveDependencies());

        // Check for circular dependencies
        const circularDependencies = this.detectCircularDependencies();
        issues.push(...circularDependencies);

        return issues;
    }

    /**
     * Checks whether the given key resolves (fully or partially) to a scoped
     * lifecycle — for multi-registrations, any scoped element counts.
     * @private
     */
    private isScopedKey(serviceName: string): boolean {
        const single = this.registrations.get(serviceName);
        if (single) {
            return single.getLifetime() === 'scoped';
        }
        const multi = this.multiRegistrations.get(serviceName);
        if (multi) {
            return multi.some((wrapper) => wrapper.getLifetime() === 'scoped');
        }
        return false;
    }

    /**
     * Detects scoped services captured anywhere below a singleton registration.
     * @private
     */
    private detectCaptiveDependencies(): string[] {
        const issues: string[] = [];

        const inspectSingleton = (
            name: string,
            resolver: ServiceWrapper,
            serviceLabel: "Service" | "Multi-service",
        ): void => {
            if (resolver.getLifetime() !== "singleton") {
                return;
            }

            for (const dependency of resolver.getDependencies()) {
                const path = this.findScopedDependencyPath(
                    dependency,
                    [name],
                    new Set([name]),
                );
                if (!path) {
                    continue;
                }

                const scopedService = path[path.length - 1];
                issues.push(
                    `${serviceLabel} '${name}' is a singleton but depends on scoped service '${scopedService}' (captive dependency) via ${path.join(" -> ")}: ` +
                        `the scoped instance would be captured beyond its scope's lifetime`,
                );
            }
        };

        this.registrations.forEach((resolver, name) => {
            inspectSingleton(name, resolver, "Service");
        });
        this.multiRegistrations.forEach((resolvers, name) => {
            for (const resolver of resolvers) {
                inspectSingleton(name, resolver, "Multi-service");
            }
        });

        return issues;
    }

    /**
     * Finds the first scoped service reachable from a dependency key.
     * The visiting set is path-local so shared dependencies can be inspected
     * from multiple singleton roots while cycles terminate safely.
     * @private
     */
    private findScopedDependencyPath(
        serviceName: string,
        path: string[],
        visiting: ReadonlySet<string>,
    ): string[] | undefined {
        const currentPath = [...path, serviceName];
        if (this.isScopedKey(serviceName)) {
            return currentPath;
        }
        if (visiting.has(serviceName)) {
            return undefined;
        }

        const nextVisiting = new Set(visiting);
        nextVisiting.add(serviceName);
        const singleResolver = this.registrations.get(serviceName);
        const resolvers = singleResolver
            ? [singleResolver]
            : (this.multiRegistrations.get(serviceName) ?? []);

        for (const resolver of resolvers) {
            for (const dependency of resolver.getDependencies()) {
                const scopedPath = this.findScopedDependencyPath(
                    dependency,
                    currentPath,
                    nextVisiting,
                );
                if (scopedPath) {
                    return scopedPath;
                }
            }
        }

        return undefined;
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

        // Include multi-registrations in the dependency graph
        this.multiRegistrations.forEach((resolvers, name) => {
            const existing = dependencyGraph.get(name) || [];
            for (const resolver of resolvers) {
                existing.push(...resolver.getDependencies());
            }
            if (existing.length > 0) {
                dependencyGraph.set(name, existing);
            }
        });

        // Depth-first search to detect cycles. Records a cycle when reaching a
        // node that is on the current path (in recursionStack) and always
        // unwinds the stack afterwards — an early return here would leave
        // stale entries behind and produce phantom cycles for services that
        // merely depend on a cycle member.
        const visit = (serviceName: string, path: string[]): void => {
            if (recursionStack.has(serviceName)) {
                const cycleStart = path.indexOf(serviceName);
                const cycle = [...path.slice(cycleStart), serviceName];
                issues.push(`Circular dependency detected: ${cycle.join(" -> ")}`);
                return;
            }

            if (visited.has(serviceName)) {
                return; // Already fully processed
            }

            visited.add(serviceName);
            recursionStack.add(serviceName);
            const currentPath = [...path, serviceName];

            const dependencies = dependencyGraph.get(serviceName) || [];
            for (const dependency of dependencies) {
                if (dependencyGraph.has(dependency)) {
                    visit(dependency, currentPath);
                }
            }

            recursionStack.delete(serviceName);
        };

        // Check each service for cycles
        dependencyGraph.forEach((_, serviceName) => {
            if (!visited.has(serviceName)) {
                visit(serviceName, []);
            }
        });

        return issues;
    }

    /**
     * Extracts parameter names from a constructor function.
     *
     * Best-effort regex parsing of `constructor.toString()` — used only for
     * dev-mode warnings, never for resolution. Known limitations (all fail
     * soft by returning fewer/no names, which skips the parameter check):
     * - default values containing commas or parentheses, e.g. `(a = [1, 2])`
     * - destructured parameters (`{ a, b }`, `[x]`) — intentionally skipped
     * - computed/exotic syntax the patterns below do not match
     *
     * @private
     * @param constructorFn - The constructor function to analyze
     * @returns Array of parameter names
     */
    private extractParameterNames(constructorFn: new (...args: any[]) => any): string[] {
        try {
            // Convert constructor to string and extract parameter list
            const constructorStr = constructorFn.toString();
            
            
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
                    const cleaned = param
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
                .filter(name => !name.startsWith('{') && !name.startsWith('['))
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

import { CircularDependencyError } from "../core/errors";
import { SingletonLifecycle } from "../core/scopes/singleton";
import { ServiceWrapper } from "../core/services/service-wrapper";
import type { TypeSafeServiceLocator } from "./contracts/interfaces";
import type { ServiceKey, ServiceRegistry } from "./contracts/types";

export { CircularDependencyError } from "../core/errors";

/**
 * ServiceProvider that provides compile-time safety and IDE autocompletion.
 *
 * This is the main service provider implementation that offers full type safety,
 * automatic type inference, and excellent IDE support for dependency injection.
 *
 * @template TRegistry - The service registry type mapping string keys to service types
 */
export class ServiceProvider<TRegistry extends ServiceRegistry>
    implements TypeSafeServiceLocator<TRegistry> {

    private readonly registrations: Readonly<Record<string, ServiceWrapper>>;
    private readonly multiRegistrations: Readonly<Record<string, ServiceWrapper[]>>;
    private _disposed = false;

    /**
     * Keys currently being resolved on this provider. Guards against
     * dependency cycles at resolve time (see {@link CircularDependencyError}).
     */
    private readonly _resolutionStack: string[] = [];

    constructor(
        registrations: Record<string, ServiceWrapper>,
        multiRegistrations: Record<string, ServiceWrapper[]> = {}
    ) {
        if (!registrations) {
            throw new Error("Registrations cannot be null or undefined");
        }
        this.registrations = { ...registrations };
        this.multiRegistrations = Object.fromEntries(
            Object.entries(multiRegistrations).map(([k, v]) => [k, [...v]])
        );
        this.addItSelfResolver();
    }

    /**
     * Type-safe service resolution with autocompletion and type inference.
     */
    get<K extends keyof TRegistry>(key: K): TRegistry[K];
    get<T extends new (...args: any) => any>(objToImplement: T): InstanceType<T>;
    get(keyOrType: any): any {
        this.ensureNotDisposed();
        const typeName = this.getTypeName(keyOrType as ServiceKey);

        // Check multi-registrations first
        const multiResolvers = this.multiRegistrations[typeName];
        if (multiResolvers) {
            return this.resolveMulti(typeName, multiResolvers);
        }

        const resolver = this.registrations[typeName];
        if (!resolver) {
            throw new Error(`No service registered for key: ${String(typeName)}`);
        }

        try {
            return this.trackResolution(typeName, () => resolver.resolve(this));
        } catch (error) {
            if (error instanceof CircularDependencyError) {
                throw error;
            }
            throw new Error(
                `Failed to resolve service ${String(typeName)}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    getAll<K extends string & keyof TRegistry>(key: K): TRegistry[K] extends (infer U)[] ? U[] : TRegistry[K][];
    getAll(key: any): any[] {
        this.ensureNotDisposed();
        const typeName = String(key);

        // Multi-registration key — resolve all wrappers
        const multiResolvers = this.multiRegistrations[typeName];
        if (multiResolvers) {
            return this.resolveMulti(typeName, multiResolvers);
        }

        // Single-registration key — wrap in array
        const resolver = this.registrations[typeName];
        if (resolver) {
            try {
                return [this.trackResolution(typeName, () => resolver.resolve(this))];
            } catch (error) {
                if (error instanceof CircularDependencyError) {
                    throw error;
                }
                throw new Error(
                    `Failed to resolve service ${String(typeName)}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }

        throw new Error(`No service registered for key: ${String(typeName)}`);
    }

    startScope(): TypeSafeServiceLocator<TRegistry> {
        this.ensureNotDisposed();

        const newRegistrations: Record<string, ServiceWrapper> = {};
        Object.entries(this.registrations).forEach(([key, resolver]) => {
            newRegistrations[key] = resolver.createScope();
        });

        const newMultiRegistrations: Record<string, ServiceWrapper[]> = {};
        Object.entries(this.multiRegistrations).forEach(([key, resolvers]) => {
            newMultiRegistrations[key] = resolvers.map(r => r.createScope());
        });

        return new ServiceProvider<TRegistry>(newRegistrations, newMultiRegistrations);
    }

    dispose(): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;

        Object.values(this.registrations).forEach((resolver) => {
            try {
                resolver.dispose?.();
            } catch (error) {
                console.error("Error disposing resolver:", error);
            }
        });

        Object.values(this.multiRegistrations).forEach((resolvers) => {
            for (const resolver of resolvers) {
                try {
                    resolver.dispose?.();
                } catch (error) {
                    console.error("Error disposing multi-registration resolver:", error);
                }
            }
        });

        this.clearRegistrations();
    }

    /**
     * Asynchronously disposes the provider and awaits all service-owned async
     * dispose handlers (Promise-returning `dispose()` or `[Symbol.asyncDispose]`).
     *
     * Dispose handlers run in parallel via `Promise.allSettled`. Individual
     * rejections are logged to `console.error` but do not abort disposal.
     * Idempotent — safe to call multiple times.
     */
    async disposeAsync(): Promise<void> {
        if (this._disposed) {
            return;
        }
        this._disposed = true;

        const tasks: Promise<unknown>[] = [];

        for (const resolver of Object.values(this.registrations)) {
            const task = this.runResolverDisposeAsync(resolver, "resolver");
            if (task) tasks.push(task);
        }

        for (const resolvers of Object.values(this.multiRegistrations)) {
            for (const resolver of resolvers) {
                const task = this.runResolverDisposeAsync(resolver, "multi-registration resolver");
                if (task) tasks.push(task);
            }
        }

        await Promise.allSettled(tasks);

        this.clearRegistrations();
    }

    /**
     * TC39 `using` hook — equivalent to `dispose()`.
     */
    [Symbol.dispose](): void {
        this.dispose();
    }

    /**
     * TC39 `await using` hook — equivalent to `disposeAsync()`.
     */
    async [Symbol.asyncDispose](): Promise<void> {
        await this.disposeAsync();
    }

    private runResolverDisposeAsync(resolver: ServiceWrapper, label: string): Promise<unknown> | undefined {
        try {
            const result = resolver.disposeAsync?.();
            if (!result) return undefined;
            return result.catch((error) => {
                console.error(`Error disposing ${label}:`, error);
            });
        } catch (error) {
            console.error(`Error disposing ${label}:`, error);
            return undefined;
        }
    }

    private clearRegistrations(): void {
        const regs = this.registrations as Record<string, ServiceWrapper>;
        for (const key of Object.keys(regs)) {
            delete regs[key];
        }
        const multiRegs = this.multiRegistrations as Record<string, ServiceWrapper[]>;
        for (const key of Object.keys(multiRegs)) {
            delete multiRegs[key];
        }
    }

    private ensureNotDisposed(): void {
        if (this._disposed) {
            throw new Error("Cannot access services from a disposed container");
        }
    }

    private resolveMulti(typeName: string, resolvers: readonly ServiceWrapper[]): any[] {
        try {
            return this.trackResolution(typeName, () =>
                resolvers.map(resolver => resolver.resolve(this))
            );
        } catch (error) {
            if (error instanceof CircularDependencyError) {
                throw error;
            }
            throw new Error(
                `Failed to resolve multi-service ${typeName}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Runs a resolution step with cycle protection: while `fn` executes,
     * `typeName` is on the resolution stack; re-entering it (directly or via
     * transitive dependencies and factories) throws a CircularDependencyError
     * instead of recursing until the call stack overflows.
     */
    private trackResolution<T>(typeName: string, fn: () => T): T {
        if (this._resolutionStack.includes(typeName)) {
            throw new CircularDependencyError([...this._resolutionStack, typeName]);
        }
        this._resolutionStack.push(typeName);
        try {
            return fn();
        } finally {
            this._resolutionStack.pop();
        }
    }

    private getTypeName<T>(keyOrType: ServiceKey<T>): string {
        return typeof keyOrType === "string" ? keyOrType : keyOrType.name;
    }

    private addItSelfResolver(): void {
        const lifecycle = new SingletonLifecycle();
        lifecycle.setFactory(() => this);

        // Use type assertion to bypass readonly modifier for this initialization
        (this.registrations as Record<string, ServiceWrapper>)[
            ServiceProvider.name
        ] = new ServiceWrapper(ServiceProvider.name, lifecycle, []);
    }
}

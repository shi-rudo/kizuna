import { SingletonLifecycle } from "../core/scopes/singleton";
import { ServiceWrapper } from "../core/services/service-wrapper";
import type { TypeSafeServiceLocator } from "./contracts/interfaces";
import type { ServiceKey, ServiceRegistry } from "./contracts/types";

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
            return resolver.resolve(this);
        } catch (error) {
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
                return [resolver.resolve(this)];
            } catch (error) {
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

        // Clear references to allow GC
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
            return resolvers.map(resolver => resolver.resolve(this));
        } catch (error) {
            throw new Error(
                `Failed to resolve multi-service ${typeName}: ${error instanceof Error ? error.message : String(error)}`,
            );
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

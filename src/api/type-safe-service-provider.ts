import { SingletonLifecycle } from "../core/scopes/singleton";
import { ServiceWrapper } from "../core/services/service-wrapper";
import type { TypeSafeServiceLocator } from "./contracts/interfaces";
import type { ServiceKey, ServiceRegistry } from "./contracts/types";

/**
 * Type-safe ServiceProvider that provides compile-time safety and IDE autocompletion.
 * 
 * @template TRegistry - The service registry type mapping string keys to service types
 */
export class TypeSafeServiceProvider<TRegistry extends ServiceRegistry> 
    implements TypeSafeServiceLocator<TRegistry> {
    
    private readonly registrations: Readonly<Record<string, ServiceWrapper>>;

    constructor(registrations: Record<string, ServiceWrapper>) {
        if (!registrations) {
            throw new Error("Registrations cannot be null or undefined");
        }
        this.registrations = { ...registrations };
        this.addItSelfResolver();
    }

    /**
     * Type-safe service resolution with autocompletion and type inference.
     */
    get<K extends keyof TRegistry>(key: K): TRegistry[K];
    get<T extends new (...args: any) => any>(objToImplement: T): InstanceType<T>;
    get(keyOrType: any): any {
        const typeName = this.getTypeName(keyOrType as ServiceKey);
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

    startScope(): TypeSafeServiceLocator<TRegistry> {
        const newRegistrations: Record<string, ServiceWrapper> = {};

        Object.entries(this.registrations).forEach(([key, resolver]) => {
            newRegistrations[key] = resolver.createScope();
        });

        return new TypeSafeServiceProvider<TRegistry>(newRegistrations);
    }

    dispose(): void {
        Object.values(this.registrations).forEach((resolver) => {
            try {
                resolver.dispose?.();
            } catch (error) {
                console.error("Error disposing resolver:", error);
            }
        });
    }

    private getTypeName<T>(keyOrType: ServiceKey<T>): string {
        return typeof keyOrType === "string" ? keyOrType : keyOrType.name;
    }

    private addItSelfResolver(): void {
        const lifecycle = new SingletonLifecycle();
        lifecycle.setFactory(() => this);

        // Use type assertion to bypass readonly modifier for this initialization
        (this.registrations as Record<string, ServiceWrapper>)[
            TypeSafeServiceProvider.name
        ] = new ServiceWrapper(TypeSafeServiceProvider.name, lifecycle, []);
    }
}
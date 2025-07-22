import type { Container, ServiceLocator } from '../../api/contracts/interfaces';

/**
 * Wraps a service with its scope, dependencies, and lifecycle management.
 */
export class ServiceWrapper {
    private readonly _name: string;
    private _lifecycle: Container | null;
    private _dependencies: readonly string[];
    private _constructorFn?: new (...args: any[]) => any;

    constructor(name: string, lifecycle: Container, dependencies: string[], constructorFn?: new (...args: any[]) => any) {
        this._name = name;
        this._lifecycle = lifecycle;
        this._dependencies = Object.freeze([...dependencies]); // Immutable copy
        this._constructorFn = constructorFn;
    }

    /**
     * Resolves the service instance with its dependencies.
     * @param serviceProvider The service provider for dependency resolution
     * @returns The resolved service instance
     */
    resolve(serviceProvider: ServiceLocator): any {
        if (!this._lifecycle) {
            throw new Error(`Cannot resolve disposed service '${this._name}'`);
        }

        if (this._dependencies.length === 0) {
            return this._lifecycle.getInstance(serviceProvider);
        }

        return this._lifecycle.getInstance(
            ...this._dependencies.map(dependency => serviceProvider.get(dependency))
        );
    }

    /**
     * Gets the service name.
     * @returns The service name
     */
    getName(): string {
        return this._name;
    }

    /**
     * Gets the service dependencies.
     * @returns Array of dependency names (readonly)
     */
    getDependencies(): readonly string[] {
        return this._dependencies;
    }

    /**
     * Creates a new scope for scoped services.
     * @returns A new ServiceWrapper instance for the new scope
     */
    createScope(): ServiceWrapper {
        if (!this._lifecycle) {
            throw new Error(`Cannot create new scope for disposed service '${this._name}'`);
        }

        return new ServiceWrapper(
            this._name,
            this._lifecycle.createScope(),
            [...this._dependencies],
            this._constructorFn
        );
    }

    /**
     * Disposes the resolver and its lifecycle.
     */
    dispose(): void {
        if (this._lifecycle) {
            this._lifecycle.dispose();
            this._lifecycle = null;
        }
    }

    /**
     * Checks if the resolver has been disposed.
     * @returns true if disposed, false otherwise
     */
    isDisposed(): boolean {
        return this._lifecycle === null;
    }

    /**
     * Gets the constructor function if this is a constructor-based registration.
     * @returns The constructor function or undefined
     */
    getConstructor(): (new (...args: any[]) => any) | undefined {
        return this._constructorFn;
    }

    /**
     * Checks if this is a constructor-based registration.
     * @returns true if constructor-based, false otherwise
     */
    isConstructorBased(): boolean {
        return this._constructorFn !== undefined;
    }
}

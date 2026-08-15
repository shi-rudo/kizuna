import { CircularDependencyError } from "../core/errors";
import {
    createDisposalLayers,
    createDisposalPlan,
} from "../core/services/disposal-order";
import type { ServiceWrapper } from "../core/services/service-wrapper";
import type { TypeSafeServiceLocator } from "./contracts/interfaces";
import type { ServiceRegistry } from "./contracts/types";
import type {
    InterfaceToken,
    InterfaceTokenService,
    RegisteredInterfaceToken,
} from "./interface-token";

export { CircularDependencyError } from "../core/errors";

/** Stable identity token for resolving the current service provider. */
export const ServiceProviderToken: unique symbol = Symbol("ServiceProvider");

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
    private readonly registrationOrder: ServiceWrapper[];
    private _disposed = false;

    /**
     * Keys currently being resolved on this provider. Guards against
     * dependency cycles at resolve time (see {@link CircularDependencyError}).
     */
    private readonly _resolutionStack: string[] = [];

    constructor(
        registrations: Record<string, ServiceWrapper>,
        multiRegistrations: Record<string, ServiceWrapper[]> = {},
        registrationOrder?: readonly ServiceWrapper[],
    ) {
        if (!registrations) {
            throw new Error("Registrations cannot be null or undefined");
        }
        this.registrations = { ...registrations };
        this.multiRegistrations = Object.fromEntries(
            Object.entries(multiRegistrations).map(([k, v]) => [k, [...v]])
        );
        this.registrationOrder = registrationOrder
            ? [...registrationOrder]
            : [
                ...Object.values(this.registrations),
                ...Object.values(this.multiRegistrations).flat(),
            ];
    }

    /**
     * Type-safe service resolution with autocompletion and type inference.
     */
    get<TToken extends InterfaceToken<unknown, string>>(
        token: RegisteredInterfaceToken<TRegistry, TToken>,
    ): InterfaceTokenService<TToken>;
    get<K extends keyof TRegistry>(
        key: K extends InterfaceToken<unknown, string> ? never : K,
    ): TRegistry[K];
    get(token: typeof ServiceProviderToken): TypeSafeServiceLocator<TRegistry>;
    get(keyOrType: keyof TRegistry | typeof ServiceProviderToken): unknown {
        this.ensureNotDisposed();

        if (keyOrType === ServiceProviderToken) {
            return this;
        }

        if (typeof keyOrType !== "string") {
            throw new TypeError("Service keys must be strings or ServiceProviderToken");
        }

        const typeName = keyOrType;

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
                { cause: error },
            );
        }
    }

    getAll<TToken extends InterfaceToken<unknown, string>>(
        token: RegisteredInterfaceToken<TRegistry, TToken>,
    ): InterfaceTokenService<TToken> extends (infer U)[]
        ? U[]
        : InterfaceTokenService<TToken>[];
    getAll<K extends string & keyof TRegistry>(
        key: K extends InterfaceToken<unknown, string> ? never : K,
    ): TRegistry[K] extends (infer U)[] ? U[] : TRegistry[K][];
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
                    { cause: error },
                );
            }
        }

        throw new Error(`No service registered for key: ${String(typeName)}`);
    }

    startScope(): TypeSafeServiceLocator<TRegistry> {
        this.ensureNotDisposed();

        const newRegistrations: Record<string, ServiceWrapper> = {};
        const scopedResolvers = new Map<ServiceWrapper, ServiceWrapper>();
        Object.entries(this.registrations).forEach(([key, resolver]) => {
            const scopedResolver = resolver.createScope();
            newRegistrations[key] = scopedResolver;
            scopedResolvers.set(resolver, scopedResolver);
        });

        const newMultiRegistrations: Record<string, ServiceWrapper[]> = {};
        Object.entries(this.multiRegistrations).forEach(([key, resolvers]) => {
            newMultiRegistrations[key] = resolvers.map((resolver) => {
                const scopedResolver = resolver.createScope();
                scopedResolvers.set(resolver, scopedResolver);
                return scopedResolver;
            });
        });

        const scopedRegistrationOrder = this.registrationOrder
            .map((resolver) => scopedResolvers.get(resolver))
            .filter((resolver): resolver is ServiceWrapper => resolver !== undefined);

        return new ServiceProvider<TRegistry>(
            newRegistrations,
            newMultiRegistrations,
            scopedRegistrationOrder,
        );
    }

    /**
     * Disposes all owned services. Cleanup failures do not stop later cleanup.
     * After all cleanup completes, this method throws one `AggregateError` that
     * contains the original failures.
     */
    dispose(): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;

        const errors: unknown[] = [];
        try {
            for (const layer of createDisposalLayers(this.registrationOrder)) {
                for (const resolver of layer) {
                    try {
                        resolver.dispose();
                    } catch (error) {
                        errors.push(error);
                    }
                }
            }
        } finally {
            this.clearRegistrations();
        }

        this.throwDisposalErrors(errors);
    }

    /**
     * Asynchronously disposes the provider and awaits all service-owned async
     * dispose handlers (Promise-returning `dispose()` or `[Symbol.asyncDispose]`).
     *
     * Independent dispose handlers run in parallel. A dependency starts only
     * after all of its consumer groups settle. Rejections do not stop other
     * cleanup. After all cleanup settles, this method throws one
     * `AggregateError` with the original failures. Idempotent — safe to call
     * multiple times.
     */
    async disposeAsync(): Promise<void> {
        if (this._disposed) {
            return;
        }
        this._disposed = true;

        let errors: readonly unknown[] = [];
        try {
            errors = await this.runDependencyAwareDisposeAsync();
        } finally {
            this.clearRegistrations();
        }

        this.throwDisposalErrors(errors);
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

    private async runDependencyAwareDisposeAsync(): Promise<readonly unknown[]> {
        const plan = createDisposalPlan(this.registrationOrder);
        if (plan.groups.length === 0) {
            return [];
        }

        const errorsByResolver = new Map<ServiceWrapper, unknown>();

        const remainingConsumerGroups = plan.groups.map(
            (group) => group.consumerGroupCount,
        );

        await new Promise<void>((resolve) => {
            let completedGroups = 0;

            const startGroup = (groupIndex: number): void => {
                const tasks = plan.groups[groupIndex].resolvers.map(
                    async (resolver) => {
                        try {
                            await resolver.disposeAsync();
                        } catch (error) {
                            errorsByResolver.set(resolver, error);
                        }
                    },
                );

                void Promise.all(tasks).then(() => {
                    completedGroups++;

                    for (const dependencyGroup of plan.groups[groupIndex].dependencyGroups) {
                        remainingConsumerGroups[dependencyGroup]--;
                        if (remainingConsumerGroups[dependencyGroup] === 0) {
                            startGroup(dependencyGroup);
                        }
                    }

                    if (completedGroups === plan.groups.length) {
                        resolve();
                    }
                });
            };

            for (const groupIndex of plan.rootGroups) {
                startGroup(groupIndex);
            }
        });

        return this.registrationOrder.flatMap((resolver) => {
            if (!errorsByResolver.has(resolver)) {
                return [];
            }
            return [errorsByResolver.get(resolver)];
        });
    }

    private throwDisposalErrors(errors: readonly unknown[]): void {
        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                "One or more services failed to dispose",
            );
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
        this.registrationOrder.length = 0;
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
                { cause: error },
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
}

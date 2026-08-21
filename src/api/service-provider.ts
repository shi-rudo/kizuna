import {
    CircularDependencyError,
    DisposalError,
    type DisposalFailure,
    type DisposalOperation,
} from "../core/errors.js";
import {
    createDisposalLayers,
    createDisposalPlan,
} from "../core/services/disposal-order.js";
import type { ServiceWrapper } from "../core/services/service-wrapper.js";
import {
    borrowableSourceCapability,
    type BorrowableSingletonSource,
    type BorrowedSingletonReference,
} from "./borrowed-singleton-capability.js";
import type {
    TypeSafeServiceLocator,
} from "./contracts/interfaces.js";
import type { ServiceRegistry } from "./contracts/types.js";
import type {
    InterfaceToken,
    InterfaceTokenService,
    RegisteredInterfaceToken,
} from "./interface-token.js";

export { CircularDependencyError, DisposalError } from "../core/errors.js";
export type { DisposalFailure, DisposalOperation } from "../core/errors.js";

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
    implements TypeSafeServiceLocator<TRegistry>, BorrowableSingletonSource {

    private readonly registrations: Map<string, ServiceWrapper>;
    private readonly multiRegistrations: Map<string, ServiceWrapper[]>;
    private readonly registrationOrder: ServiceWrapper[];
    private readonly isRootContainer: boolean;
    private _disposed = false;

    get [Symbol.toStringTag]():
        | "KizunaRootServiceContainer"
        | "KizunaServiceScope" {
        return this.isRootContainer
            ? "KizunaRootServiceContainer"
            : "KizunaServiceScope";
    }

    /**
     * Keys currently being resolved on this provider. Guards against
     * dependency cycles at resolve time (see {@link CircularDependencyError}).
     */
    private readonly _resolutionStack: string[] = [];

    constructor(
        registrations: ReadonlyMap<string, ServiceWrapper>,
        multiRegistrations: ReadonlyMap<string, readonly ServiceWrapper[]> = new Map(),
        registrationOrder?: readonly ServiceWrapper[],
        isRootContainer = true,
    ) {
        if (!registrations) {
            throw new Error("Registrations cannot be null or undefined");
        }
        this.registrations = new Map(registrations);
        this.multiRegistrations = new Map(
            [...multiRegistrations].map(([key, resolvers]) => [key, [...resolvers]]),
        );
        this.isRootContainer = isRootContainer;
        this.registrationOrder = registrationOrder
            ? [...registrationOrder]
            : [
                ...this.registrations.values(),
                ...[...this.multiRegistrations.values()].flat(),
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
        const multiResolvers = this.multiRegistrations.get(typeName);
        if (multiResolvers) {
            return this.resolveMulti(typeName, multiResolvers);
        }

        const resolver = this.registrations.get(typeName);
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
        const multiResolvers = this.multiRegistrations.get(typeName);
        if (multiResolvers) {
            return this.resolveMulti(typeName, multiResolvers);
        }

        // Single-registration key — wrap in array
        const resolver = this.registrations.get(typeName);
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

        const newRegistrations = new Map<string, ServiceWrapper>();
        const scopedResolvers = new Map<ServiceWrapper, ServiceWrapper>();
        this.registrations.forEach((resolver, key) => {
            const scopedResolver = resolver.createScope();
            newRegistrations.set(key, scopedResolver);
            scopedResolvers.set(resolver, scopedResolver);
        });

        const newMultiRegistrations = new Map<string, ServiceWrapper[]>();
        this.multiRegistrations.forEach((resolvers, key) => {
            newMultiRegistrations.set(key, resolvers.map((resolver) => {
                const scopedResolver = resolver.createScope();
                scopedResolvers.set(resolver, scopedResolver);
                return scopedResolver;
            }));
        });

        const scopedRegistrationOrder = this.registrationOrder
            .map((resolver) => scopedResolvers.get(resolver))
            .filter((resolver): resolver is ServiceWrapper => resolver !== undefined);

        return new ServiceProvider<TRegistry>(
            newRegistrations,
            newMultiRegistrations,
            scopedRegistrationOrder,
            false,
        );
    }

    /**
     * Creates a restricted resolver for one directly owned root singleton.
     * @internal
     */
    [borrowableSourceCapability](key: string): BorrowedSingletonReference {
        this.ensureNotDisposed();

        if (!this.isRootContainer) {
            throw new Error(
                `Cannot borrow service '${key}'. The source is a scope. Use the root container that owns the singleton.`,
            );
        }

        if (this.multiRegistrations.has(key)) {
            throw new Error(
                `Cannot borrow service '${key}'. Multi-service registrations are not supported.`,
            );
        }

        const registration = this.registrations.get(key);
        if (!registration) {
            throw new Error(
                `Cannot borrow service '${key}'. The source has no such registration.`,
            );
        }

        const lifetime = registration.getLifetime();
        if (lifetime !== "singleton") {
            throw new Error(
                `Cannot borrow service '${key}'. The source registration is ${lifetime}. Only singleton registrations can be borrowed.`,
            );
        }

        if (!registration.ownsSingletonValue()) {
            throw new Error(
                `Cannot borrow service '${key}'. The source does not own this singleton.`,
            );
        }

        return Object.freeze({
            resolve: () => this.get(key as never),
        });
    }

    /**
     * Disposes all owned services. Cleanup failures do not stop later cleanup.
     * After all cleanup completes, this method throws one `DisposalError` that
     * contains the original failures.
     */
    dispose(): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;

        const failures: DisposalFailure[] = [];
        try {
            for (const layer of createDisposalLayers(this.registrationOrder)) {
                for (const resolver of layer) {
                    try {
                        resolver.dispose();
                    } catch (error) {
                        failures.push(this.createDisposalFailure(
                            resolver,
                            "dispose",
                            error,
                        ));
                    }
                }
            }
        } finally {
            this.clearRegistrations();
        }

        this.throwDisposalFailures(failures);
    }

    /**
     * Asynchronously disposes the provider and awaits all service-owned async
     * cleanup. This includes resolved values from singleton and scoped Promise
     * factories.
     *
     * Independent dispose handlers run in parallel. A dependency starts only
     * after all of its consumer groups settle. Rejections do not stop other
     * cleanup. After all cleanup settles, this method throws one
     * `DisposalError` with the original failures. Idempotent — safe to call
     * multiple times.
     */
    async disposeAsync(): Promise<void> {
        if (this._disposed) {
            return;
        }
        this._disposed = true;

        let failures: readonly DisposalFailure[] = [];
        try {
            failures = await this.runDependencyAwareDisposeAsync();
        } finally {
            this.clearRegistrations();
        }

        this.throwDisposalFailures(failures);
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

    private async runDependencyAwareDisposeAsync(): Promise<readonly DisposalFailure[]> {
        const plan = createDisposalPlan(this.registrationOrder);
        if (plan.groups.length === 0) {
            return [];
        }

        const failuresByResolver = new Map<ServiceWrapper, DisposalFailure>();

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
                            failuresByResolver.set(
                                resolver,
                                this.createDisposalFailure(
                                    resolver,
                                    "disposeAsync",
                                    error,
                                ),
                            );
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
            const failure = failuresByResolver.get(resolver);
            return failure ? [failure] : [];
        });
    }

    private createDisposalFailure(
        resolver: ServiceWrapper,
        operation: DisposalOperation,
        error: unknown,
    ): DisposalFailure {
        return Object.freeze({
            serviceKey: resolver.getName(),
            lifetime: resolver.getLifetime(),
            operation,
            error,
        });
    }

    private throwDisposalFailures(failures: readonly DisposalFailure[]): void {
        if (failures.length > 0) {
            throw new DisposalError(
                failures.map((failure) => failure.error),
                undefined,
                failures,
            );
        }
    }

    private clearRegistrations(): void {
        this.registrations.clear();
        this.multiRegistrations.clear();
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

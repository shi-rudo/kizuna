import {
    CircularDependencyError,
    DisposalError,
    type DisposalFailure,
} from "../core/errors.js";
import { DisposalCoordinator } from "../core/services/disposal-coordinator.js";
import type { ServiceWrapper } from "../core/services/service-wrapper.js";
import {
    borrowableSourceCapability,
    type BorrowableSingletonSource,
    type BorrowedSingletonReference,
} from "./borrowed-singleton-capability.js";
import type {
    TypeSafeServiceLocator,
    TypeSafeServiceResolver,
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

interface ServiceProviderOptions {
    readonly registrations: ReadonlyMap<string, ServiceWrapper>;
    readonly multiRegistrations?: ReadonlyMap<string, readonly ServiceWrapper[]>;
    readonly registrationOrder?: readonly ServiceWrapper[];
    readonly maxAsyncDisposalConcurrency: number;
    readonly isRootContainer?: boolean;
}

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
    private readonly maxAsyncDisposalConcurrency: number;
    private readonly factoryResolver: TypeSafeServiceResolver<TRegistry>;
    private readonly disposalCoordinator: DisposalCoordinator;
    private _disposed = false;
    private _activeAsyncDisposal?: Promise<void>;

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

    constructor(options: ServiceProviderOptions) {
        const {
            registrations,
            multiRegistrations = new Map(),
            registrationOrder,
            maxAsyncDisposalConcurrency,
            isRootContainer = true,
        } = options;
        if (!registrations) {
            throw new Error("Registrations cannot be null or undefined");
        }
        this.registrations = new Map(registrations);
        this.multiRegistrations = new Map(
            [...multiRegistrations].map(([key, resolvers]) => [key, [...resolvers]]),
        );
        this.isRootContainer = isRootContainer;
        this.maxAsyncDisposalConcurrency = maxAsyncDisposalConcurrency;
        this.registrationOrder = registrationOrder
            ? [...registrationOrder]
            : [
                ...this.registrations.values(),
                ...[...this.multiRegistrations.values()].flat(),
            ];
        this.disposalCoordinator = new DisposalCoordinator(
            this.registrationOrder,
            this.multiRegistrations,
            this.maxAsyncDisposalConcurrency,
        );
        this.factoryResolver = Object.freeze({
            get: (key: unknown) => {
                if (typeof key !== "string") {
                    throw new TypeError("Factory service keys must be strings");
                }
                return this.get(key as never);
            },
            getAll: (key: unknown) => {
                if (typeof key !== "string") {
                    throw new TypeError("Factory service keys must be strings");
                }
                return this.getAll(key as never);
            },
        }) as unknown as TypeSafeServiceResolver<TRegistry>;
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
            return this.trackResolution(typeName, () =>
                resolver.resolve(this.factoryResolver)
            );
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
    getAll(key: unknown): any[] {
        this.ensureNotDisposed();
        if (typeof key !== "string") {
            throw new TypeError("Service keys must be strings");
        }
        const typeName = key;

        // Multi-registration key — resolve all wrappers
        const multiResolvers = this.multiRegistrations.get(typeName);
        if (multiResolvers) {
            return this.resolveMulti(typeName, multiResolvers);
        }

        // Single-registration key — wrap in array
        const resolver = this.registrations.get(typeName);
        if (resolver) {
            try {
                return [this.trackResolution(typeName, () =>
                    resolver.resolve(this.factoryResolver)
                )];
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

        return new ServiceProvider<TRegistry>({
            registrations: newRegistrations,
            multiRegistrations: newMultiRegistrations,
            registrationOrder: scopedRegistrationOrder,
            maxAsyncDisposalConcurrency: this.maxAsyncDisposalConcurrency,
            isRootContainer: false,
        });
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

        let failures: readonly DisposalFailure[] = [];
        try {
            failures = this.disposalCoordinator.dispose();
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
     * Independent dispose handlers run in parallel up to the configured limit.
     * A dependency starts only after all of its consumer groups settle.
     * Rejections do not stop other cleanup. Concurrent calls wait for the same
     * active operation. After all cleanup settles, this method throws one
     * `DisposalError` with the original failures.
     */
    disposeAsync(): Promise<void> {
        if (this._activeAsyncDisposal) {
            return this._activeAsyncDisposal;
        }
        if (this._disposed) {
            return Promise.resolve();
        }
        this._disposed = true;

        const operation = this.disposeAsynchronously();
        this._activeAsyncDisposal = operation;
        void operation.then(
            () => {
                this._activeAsyncDisposal = undefined;
            },
            () => {
                this._activeAsyncDisposal = undefined;
            },
        );
        return operation;
    }

    private async disposeAsynchronously(): Promise<void> {
        let failures: readonly DisposalFailure[] = [];
        try {
            failures = await this.disposalCoordinator.disposeAsync();
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
                resolvers.map(resolver => resolver.resolve(this.factoryResolver))
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

import { expectTypeOf, test } from "vitest";
import * as Kizuna from "../src";

class Logger {}

class TaggedPromise<T> extends Promise<T> {
	readonly tag = "factory-promise";
}

test("the package root does not expose provider construction or internals", () => {
	// @ts-expect-error ServiceProvider construction is internal to ContainerBuilder.
	new Kizuna.ServiceProvider<{ ghost: Logger }>({});
	// @ts-expect-error Lifecycle implementations are not public API.
	Kizuna.SingletonLifecycle;
	// @ts-expect-error Service wrappers are not public API.
	Kizuna.ServiceWrapper;
});

test("disposal errors require callers to narrow each original error", () => {
	const disposalError = new Kizuna.DisposalError([new Error("cleanup failed")]);
	expectTypeOf(disposalError.errors).toEqualTypeOf<unknown[]>();

	const originalError = disposalError.errors[0];
	// @ts-expect-error Original errors must be narrowed before property access.
	originalError.message;
});

test("legacy service contracts are not public API", () => {
	// @ts-expect-error The unsafe ServiceLocator contract is internal.
	type UnsafeLocator = Kizuna.ServiceLocator;
	// @ts-expect-error ServiceKey advertised unsupported constructor keys.
	type LegacyServiceKey = Kizuna.ServiceKey<Logger>;
	// @ts-expect-error Factory types are inferred by registration methods.
	type LegacyFactory = Kizuna.Factory<Logger>;
	// @ts-expect-error Registrar contracts are internal implementation details.
	type LegacyRegistrar = Kizuna.TypeSafeRegistrar<Logger>;

	void (null as unknown as UnsafeLocator);
	void (null as unknown as LegacyServiceKey);
	void (null as unknown as LegacyFactory);
	void (null as unknown as LegacyRegistrar);
});

test("factory registrations require one fixed service key", () => {
	const broadKey = null as unknown as string;
	const unionKey = null as unknown as "first" | "second";
	const patternKey = null as unknown as `factory:${string}`;

	// @ts-expect-error A broad key would make every string appear registered.
	new Kizuna.ContainerBuilder().registerSingletonFactory(broadKey, () => 1);
	// @ts-expect-error A union would claim a key that was not registered at runtime.
	new Kizuna.ContainerBuilder().registerScopedFactory(unionKey, () => 1);
	// @ts-expect-error An open pattern would claim keys that were not registered.
	new Kizuna.ContainerBuilder().registerTransientFactory(patternKey, () => 1);
	// @ts-expect-error Multi-factory registrations also reject broad keys.
	new Kizuna.ContainerBuilder().addSingletonFactory(broadKey, () => 1);
	// @ts-expect-error Multi-factory registrations also reject union keys.
	new Kizuna.ContainerBuilder().addScopedFactory(unionKey, () => 1);
	// @ts-expect-error Multi-factory registrations also reject open patterns.
	new Kizuna.ContainerBuilder().addTransientFactory(patternKey, () => 1);

	const provider = new Kizuna.ContainerBuilder()
		.registerSingletonFactory("answer", () => 42)
		.build();
	expectTypeOf(provider.get("answer")).toEqualTypeOf<number>();
	// @ts-expect-error Only the fixed registered key is available.
	provider.get("never-registered");
});

test("cached Promise factories expose their normalized observer type", () => {
	const factoryPromise = new TaggedPromise<string>(() => undefined);
	const provider = new Kizuna.ContainerBuilder()
		.registerSingletonFactory("singleton", () => factoryPromise)
		.registerScopedFactory("scoped", () => factoryPromise)
		.registerTransientFactory("transient", () => factoryPromise)
		.addSingletonFactory("cached", () => factoryPromise)
		.addScopedFactory("cached", () => factoryPromise)
		.addTransientFactory("transient-group", () => factoryPromise)
		.build();

	expectTypeOf(provider.get("singleton")).toEqualTypeOf<Promise<string>>();
	expectTypeOf(provider.get("scoped")).toEqualTypeOf<Promise<string>>();
	expectTypeOf(provider.getAll("cached")).toEqualTypeOf<Promise<string>[]>();
	expectTypeOf(provider.get("transient")).toEqualTypeOf<TaggedPromise<string>>();
	expectTypeOf(provider.getAll("transient-group")).toEqualTypeOf<
		TaggedPromise<string>[]
	>();
});

test("typed builders do not expose destructive registry mutations", () => {
	const builder = new Kizuna.ContainerBuilder().registerSingleton(
		"logger",
		Logger,
	);

	// @ts-expect-error Removing a runtime registration would leave a stale registry type.
	builder.remove("logger");
	// @ts-expect-error Clearing runtime registrations would leave a stale registry type.
	builder.clear();
	// @ts-expect-error Management uses stable string keys, not constructor.name.
	builder.isRegistered(Logger);

	expectTypeOf(builder.isRegistered("logger")).toEqualTypeOf<boolean>();
});

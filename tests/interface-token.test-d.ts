import { expectTypeOf, test } from "vitest";
import { ContainerBuilder, interfaceToken } from "../src";

interface LoggerContract {
	log(message: string): void;
}

class Logger implements LoggerContract {
	log(_message: string): void {}
}

interface EmailContract {
	send(message: string): void;
}

class SMTPEmailService implements EmailContract {
	constructor(readonly logger: LoggerContract) {}

	send(message: string): void {
		this.logger.log(message);
	}
}

class NoDependencyEmailService implements EmailContract {
	send(_message: string): void {}
}

interface CacheContract {
	get(key: string): unknown;
}

class RedisCache implements CacheContract {
	constructor(readonly logger: LoggerContract) {}

	get(key: string): unknown {
		this.logger.log(key);
		return undefined;
	}
}

interface ValidatorContract {
	validate(value: unknown): boolean;
}

class Validator implements ValidatorContract {
	validate(_value: unknown): boolean {
		return true;
	}
}

class EmailConsumer {
	constructor(readonly email: EmailContract) {}
}

class Plugin {
	run(): void {}
}

class Config {
	readonly kind = "config" as const;
}

interface ConsumerContract {
	run(): void;
}

class Consumer implements ConsumerContract {
	constructor(
		readonly logger: LoggerContract,
		readonly config: Config,
	) {}

	run(): void {}
}

interface WrongConsumer {
	fail(): void;
}

interface MixedConsumerConstructor {
	new (logger: LoggerContract): WrongConsumer;
	new (logger: LoggerContract, config: Config): ConsumerContract;
}

declare const MixedConsumer: MixedConsumerConstructor;

const EmailService = interfaceToken<EmailContract>()("EmailService");
const Cache = interfaceToken<CacheContract>()("Cache");
const ValidatorService = interfaceToken<ValidatorContract>()("Validator");

test("interface tokens infer interface registration keys and service types", () => {
	const provider = new ContainerBuilder()
		.registerSingleton("Logger", Logger)
		.registerSingletonInterface(EmailService, SMTPEmailService, "Logger")
		.registerScopedInterface(Cache, RedisCache, "Logger")
		.registerTransientInterface(ValidatorService, Validator)
		.registerSingleton("EmailConsumer", EmailConsumer, EmailService)
		.build();

	expectTypeOf(provider.get(EmailService)).toEqualTypeOf<EmailContract>();
	expectTypeOf(provider.get(Cache)).toEqualTypeOf<CacheContract>();
	expectTypeOf(
		provider.get(ValidatorService),
	).toEqualTypeOf<ValidatorContract>();
	expectTypeOf(provider.get("EmailService")).toEqualTypeOf<EmailContract>();
	expectTypeOf(provider.get("EmailConsumer")).toEqualTypeOf<EmailConsumer>();
	expectTypeOf(provider.startScope().get(Cache)).toEqualTypeOf<CacheContract>();
	expectTypeOf(provider.getAll(EmailService)).toEqualTypeOf<EmailContract[]>();

	const Missing = interfaceToken<EmailContract>()("Missing");
	// @ts-expect-error An unregistered token must not resolve.
	provider.get(Missing);

	const WrongEmailService = interfaceToken<CacheContract>()("EmailService");
	// @ts-expect-error A token with the right key but the wrong service type must not resolve.
	provider.get(WrongEmailService);
	// @ts-expect-error getAll must also reject a token with the wrong service type.
	provider.getAll(WrongEmailService);
});

test("interface tokens preserve getAll array semantics", () => {
	const Plugins = interfaceToken<Plugin[]>()("Plugins");
	const provider = new ContainerBuilder()
		.addSingleton("Plugins", Plugin)
		.build();

	expectTypeOf(provider.get(Plugins)).toEqualTypeOf<Plugin[]>();
	expectTypeOf(provider.getAll(Plugins)).toEqualTypeOf<Plugin[]>();
});

test("interface tokens require fixed keys and replace string registrations", () => {
	const broadKey = null as unknown as string;
	interfaceToken<EmailContract>()(
		// @ts-expect-error A broad string cannot define one registry key.
		broadKey,
	);

	type UnionKey = "EmailService" | "OtherEmailService";
	const unionKey = null as unknown as UnionKey;
	interfaceToken<EmailContract>()(
		// @ts-expect-error A union cannot define one registry key.
		unionKey,
	);

	type PatternKey = `email:${string}`;
	const patternKey = null as unknown as PatternKey;
	interfaceToken<EmailContract>()(
		// @ts-expect-error An open pattern cannot define one registry key.
		patternKey,
	);

	type NumericPatternKey = `email:${number}`;
	const numericPatternKey = null as unknown as NumericPatternKey;
	interfaceToken<EmailContract>()(
		// @ts-expect-error An open numeric pattern cannot define one registry key.
		numericPatternKey,
	);

	const numericToken = interfaceToken<EmailContract>()("email:123");
	expectTypeOf(numericToken).toMatchTypeOf<"email:123">();

	const builder = new ContainerBuilder();
	// @ts-expect-error Interface registration requires an interface token.
	builder.registerSingletonInterface<EmailContract, "legacy-singleton">(
		"legacy-singleton",
		NoDependencyEmailService,
	);
	// @ts-expect-error Interface registration requires an interface token.
	builder.registerScopedInterface<EmailContract, "legacy-scoped">(
		"legacy-scoped",
		NoDependencyEmailService,
	);
	// @ts-expect-error Interface registration requires an interface token.
	builder.registerTransientInterface<EmailContract, "legacy-transient">(
		"legacy-transient",
		NoDependencyEmailService,
	);
});

test("interface token dependencies match implementation parameters", () => {
	const builder = new ContainerBuilder()
		.registerSingleton("Logger", Logger)
		.registerSingleton("Config", Config);

	const SingletonConsumer =
		interfaceToken<ConsumerContract>()("SingletonConsumer");
	const ScopedConsumer = interfaceToken<ConsumerContract>()("ScopedConsumer");
	const TransientConsumer =
		interfaceToken<ConsumerContract>()("TransientConsumer");

	const provider = builder
		.registerSingletonInterface(SingletonConsumer, Consumer, "Logger", "Config")
		.registerScopedInterface(ScopedConsumer, Consumer, "Logger", "Config")
		.registerTransientInterface(TransientConsumer, Consumer, "Logger", "Config")
		.build();

	expectTypeOf(
		provider.get(SingletonConsumer),
	).toEqualTypeOf<ConsumerContract>();
	expectTypeOf(provider.get(ScopedConsumer)).toEqualTypeOf<ConsumerContract>();
	expectTypeOf(
		provider.get(TransientConsumer),
	).toEqualTypeOf<ConsumerContract>();

	const WrongImplementation = interfaceToken<EmailContract>()(
		"WrongImplementation",
	);
	// @ts-expect-error The implementation must satisfy the token interface.
	builder.registerSingletonInterface(WrongImplementation, Validator);

	const SingletonNoDependencies = interfaceToken<ConsumerContract>()(
		"SingletonNoDependencies",
	);
	const ScopedNoDependencies = interfaceToken<ConsumerContract>()(
		"ScopedNoDependencies",
	);
	const TransientNoDependencies = interfaceToken<ConsumerContract>()(
		"TransientNoDependencies",
	);
	// @ts-expect-error A required singleton dependency cannot be omitted.
	builder.registerSingletonInterface(SingletonNoDependencies, Consumer);
	// @ts-expect-error A required scoped dependency cannot be omitted.
	builder.registerScopedInterface(ScopedNoDependencies, Consumer);
	// @ts-expect-error A required transient dependency cannot be omitted.
	builder.registerTransientInterface(TransientNoDependencies, Consumer);

	const SingletonMixed = interfaceToken<ConsumerContract>()("SingletonMixed");
	const ScopedMixed = interfaceToken<ConsumerContract>()("ScopedMixed");
	const TransientMixed = interfaceToken<ConsumerContract>()("TransientMixed");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Every singleton constructor result must satisfy the token interface.
	builder.registerSingletonInterface(SingletonMixed, MixedConsumer, "Logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Every scoped constructor result must satisfy the token interface.
	builder.registerScopedInterface(ScopedMixed, MixedConsumer, "Logger");
	// biome-ignore format: Keep the expected TypeScript error on the next line.
	// @ts-expect-error Every transient constructor result must satisfy the token interface.
	builder.registerTransientInterface(TransientMixed, MixedConsumer, "Logger");

	const SingletonInvalid =
		interfaceToken<ConsumerContract>()("SingletonInvalid");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Singleton dependencies reject unknown keys.
	builder.registerSingletonInterface(SingletonInvalid, Consumer, "Logger", "Missing");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Singleton dependencies reject the wrong service type.
	builder.registerSingletonInterface(SingletonInvalid, Consumer, "Logger", "Logger");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Singleton dependencies follow the constructor parameter order.
	builder.registerSingletonInterface(SingletonInvalid, Consumer, "Config", "Logger");
	// @ts-expect-error Singleton dependencies include every required parameter.
	builder.registerSingletonInterface(SingletonInvalid, Consumer, "Logger");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Singleton dependencies reject additional keys.
	builder.registerSingletonInterface(SingletonInvalid, Consumer, "Logger", "Config", "Config");

	const ScopedInvalid = interfaceToken<ConsumerContract>()("ScopedInvalid");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Scoped dependencies reject unknown keys.
	builder.registerScopedInterface(ScopedInvalid, Consumer, "Logger", "Missing");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Scoped dependencies reject the wrong service type.
	builder.registerScopedInterface(ScopedInvalid, Consumer, "Logger", "Logger");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Scoped dependencies follow the constructor parameter order.
	builder.registerScopedInterface(ScopedInvalid, Consumer, "Config", "Logger");
	// @ts-expect-error Scoped dependencies include every required parameter.
	builder.registerScopedInterface(ScopedInvalid, Consumer, "Logger");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Scoped dependencies reject additional keys.
	builder.registerScopedInterface(ScopedInvalid, Consumer, "Logger", "Config", "Config");

	const TransientInvalid =
		interfaceToken<ConsumerContract>()("TransientInvalid");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Transient dependencies reject unknown keys.
	builder.registerTransientInterface(TransientInvalid, Consumer, "Logger", "Missing");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Transient dependencies reject the wrong service type.
	builder.registerTransientInterface(TransientInvalid, Consumer, "Logger", "Logger");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Transient dependencies follow the constructor parameter order.
	builder.registerTransientInterface(TransientInvalid, Consumer, "Config", "Logger");
	// @ts-expect-error Transient dependencies include every required parameter.
	builder.registerTransientInterface(TransientInvalid, Consumer, "Logger");
	// biome-ignore format: Keep TypeScript errors on the statement lines.
	// @ts-expect-error Transient dependencies reject additional keys.
	builder.registerTransientInterface(TransientInvalid, Consumer, "Logger", "Config", "Config");
});

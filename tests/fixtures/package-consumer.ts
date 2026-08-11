import * as Kizuna from "@shirudo/kizuna";

class Logger {}

const container = new Kizuna.ContainerBuilder()
	.registerSingleton("Logger", Logger)
	.build();

container.get("Logger");
container.get(Kizuna.ServiceProviderToken);

// @ts-expect-error The concrete provider is not public API.
Kizuna.ServiceProvider;
// @ts-expect-error Lifecycle implementations are not public API.
Kizuna.SingletonLifecycle;
// @ts-expect-error Legacy service key contracts are not public API.
type LegacyKey = Kizuna.ServiceKey<Logger>;

void (null as unknown as LegacyKey);

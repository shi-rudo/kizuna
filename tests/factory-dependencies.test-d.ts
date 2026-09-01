import { ContainerBuilder } from "../src";

class Logger {}

const builder = new ContainerBuilder().registerSingleton("logger", Logger);

builder.registerSingletonFactory(
	"singleton",
	(provider) => provider.get("logger"),
	"logger",
);
builder.registerScopedFactory(
	"scoped",
	(provider) => provider.get("logger"),
	"logger",
);
builder.registerTransientFactory(
	"transient",
	(provider) => provider.get("logger"),
	"logger",
);
builder.addSingletonFactory(
	"singletons",
	(provider) => provider.get("logger"),
	"logger",
);
builder.addScopedFactory(
	"scopedServices",
	(provider) => provider.get("logger"),
	"logger",
);
builder.addTransientFactory(
	"transientServices",
	(provider) => provider.get("logger"),
	"logger",
);

// @ts-expect-error Factory metadata rejects an unknown dependency key.
builder.registerSingletonFactory("invalid", () => ({}), "missing");

// @ts-expect-error Multi-factory metadata rejects an unknown dependency key.
builder.addSingletonFactory("invalidGroup", () => ({}), "missing");

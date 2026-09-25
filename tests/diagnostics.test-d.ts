import {
	ContainerBuilder,
	type DiagnosticEvent,
	type DiagnosticLevel,
	type DiagnosticsOptions,
	type DisposalOperation,
} from "../src";

interface AppLogger {
	error(fields: object, message: string): void;
	debug(fields: object, message: string): void;
}

declare const logger: AppLogger;

// Logging every event needs no code: the level names the logger method.
new ContainerBuilder().build({
	diagnostics: {
		level: "debug",
		listener: (event) => logger[event.level](event, event.message),
	},
});

const listener = (event: DiagnosticEvent): void => {
	if (event.code === "UNAWAITED_CLEANUP_FAILED") {
		const serviceKey: string = event.serviceKey;
		const operation: DisposalOperation = event.operation;
		const error: unknown = event.error;
		void [serviceKey, operation, error];
	}
	if (event.code === "SERVICE_CREATED") {
		const path: readonly string[] = event.path;
		// @ts-expect-error The resolution path is immutable.
		event.path.push("other");
		void path;
	}
	if (event.code === "CONTAINER_DISPOSED") {
		const container: "root" | "scope" = event.container;
		const failureCount: number = event.failureCount;
		void [container, failureCount];
	}
	// @ts-expect-error Only some events have a service key.
	void event.serviceKey;
	// @ts-expect-error Events are immutable.
	event.message = "changed";
};

const options: DiagnosticsOptions = { listener };
new ContainerBuilder().build({ diagnostics: options });

const level: DiagnosticLevel = "error";
new ContainerBuilder().build({ diagnostics: { listener, level } });

// @ts-expect-error The level must be error or debug.
new ContainerBuilder().build({ diagnostics: { listener, level: "info" } });

// @ts-expect-error A diagnostics option needs a listener.
new ContainerBuilder().build({ diagnostics: { level: "debug" } });

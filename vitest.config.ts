import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov", "json", "json-summary"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/index.ts",
				"src/api/index.ts",
				"src/core/index.ts",
				"src/api/contracts/interfaces.ts",
				"src/api/contracts/types.ts",
				"src/api/literal-service-key.ts",
			],
			// docs/feature-evidence.md lists the same thresholds and the measured values.
			thresholds: {
				statements: 96,
				branches: 90,
				functions: 99,
				lines: 96,
				// Lifecycles decide when a value is created, cached, closed, and disposed.
				"src/core/scopes/**": { 100: true },
				// Disposal order, ownership, and cleanup hooks.
				"src/core/services/**": { statements: 95, branches: 85, lines: 95 },
			},
		},
	},
});

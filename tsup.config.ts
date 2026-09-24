import { defineConfig } from "tsup";

export default defineConfig({
	// The export map publishes only the root entry, so only it gets a bundle.
	entry: {
		index: "src/index.ts",
	},
	format: ["esm", "cjs"],
	dts: false,
	splitting: false,
	sourcemap: true,
	clean: true,
	outExtension(ctx) {
		return {
			js: ctx.format === "esm" ? ".mjs" : ".cjs",
		};
	},
});

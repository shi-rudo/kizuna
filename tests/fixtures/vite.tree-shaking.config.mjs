import { defineConfig } from "vite";

// Builds only the tree-shaking consumer, minified, as a production app would.
export default defineConfig({
	logLevel: "warn",
	build: {
		outDir: "dist-tree-shaking",
		emptyOutDir: true,
		minify: true,
		rollupOptions: {
			input: "./tree-shaking-consumer.js",
			output: { entryFileNames: "[name].js" },
		},
	},
});

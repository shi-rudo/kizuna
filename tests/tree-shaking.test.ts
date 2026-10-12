import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { beforeAll, describe, expect, it } from "vitest";
import {
	findTreeShakingProblems,
	readBundle,
} from "./fixtures/check-tree-shaking.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const builtPackage = join(repositoryRoot, "dist", "index.mjs");
const consumerEntry = join(
	repositoryRoot,
	"tests",
	"fixtures",
	"tree-shaking-consumer.js",
);

// The Vite build can be slow on a cold runner.
const toolTimeout = 60_000;

interface OutputChunk {
	readonly type: string;
	readonly code?: string;
}

// Bundles the consumer against the built package with the Vite version that
// this repository pins, minified like a production app.
async function bundleConsumer(): Promise<string> {
	const result = await build({
		configFile: false,
		logLevel: "silent",
		root: join(repositoryRoot, "tests", "fixtures"),
		resolve: { alias: { "@shirudo/kizuna": builtPackage } },
		build: {
			write: false,
			emptyOutDir: false,
			outDir: join(tmpdir(), "kizuna-tree-shaking"),
			minify: true,
			rollupOptions: { input: consumerEntry },
		},
	});
	const outputs = (Array.isArray(result) ? result : [result]) as {
		output: OutputChunk[];
	}[];
	return outputs
		.flatMap((output) => output.output)
		.filter((chunk) => chunk.type === "chunk")
		.map((chunk) => chunk.code ?? "")
		.join("\n");
}

describe("a consumer that imports only interfaceToken", () => {
	beforeAll(() => {
		if (!existsSync(builtPackage)) {
			throw new Error(
				"dist/index.mjs not found. Run `pnpm build` before the tree-shaking tests, " +
					"or run `pnpm test` from CI where build runs first.",
			);
		}
	});

	it(
		"keeps no other Kizuna code in its bundle",
		async () => {
			const bundle = await bundleConsumer();

			expect(findTreeShakingProblems(bundle)).toEqual([]);
		},
		toolTimeout,
	);
});

describe("the tree-shaking check", () => {
	const consumerCode = 'function e(){return e=>e}console.log(e()("clock"));';

	it("reports a bundle that still imports the package", () => {
		const bundle = `import{interfaceToken as e}from"@shirudo/kizuna";${consumerCode}`;

		expect(findTreeShakingProblems(bundle)).toEqual([
			"The bundle still imports @shirudo/kizuna instead of bundling it.",
		]);
	});

	it("reads Kizuna code that the build wrote to a nested chunk", () => {
		const outDir = mkdtempSync(join(tmpdir(), "kizuna-tree-shaking-check-"));
		try {
			writeFileSync(join(outDir, "consumer.js"), consumerCode);
			mkdirSync(join(outDir, "assets"));
			writeFileSync(
				join(outDir, "assets", "chunk.js"),
				"var t=Object.freeze({containerBuilt(){}});",
			);

			const problems = findTreeShakingProblems(readBundle(outDir));

			expect(problems).toEqual([
				"The bundle keeps unused Kizuna code: diagnostics.",
			]);
		} finally {
			rmSync(outDir, { recursive: true, force: true });
		}
	});
});

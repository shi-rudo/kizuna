import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "tsup";
import { beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const KiB = 1024;

// The documented size budgets. docs/feature-evidence.md lists the same values.
const sizeBudgets = {
	minifiedEsmGzip: 9 * KiB,
	shippedEsmGzip: 20 * KiB,
	packedTarball: 200 * KiB,
	unpackedTarball: 900 * KiB,
} as const;

interface PackResult {
	readonly size: number;
	readonly unpackedSize: number;
	readonly files: readonly { readonly path: string }[];
}

interface PackageManifest {
	readonly main?: string;
	readonly module?: string;
	readonly exports?: unknown;
}

// Reads what npm would publish from the current dist directory.
function packPackage(): PackResult {
	// pnpm passes its own npm_config_* settings, which npm warns about.
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([key]) => !key.toLowerCase().startsWith("npm_config_"),
		),
	);
	const output = execFileSync(
		"npm",
		["pack", "--dry-run", "--json", "--ignore-scripts"],
		{
			cwd: repositoryRoot,
			encoding: "utf8",
			env,
			// npm is npm.cmd on Windows, which Node starts only through a shell.
			shell: process.platform === "win32",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const [result] = JSON.parse(output) as PackResult[];
	if (!result) {
		throw new Error("npm pack returned no result");
	}
	return result;
}

// Returns the gzip size of the ESM bundle that a consumer build minifies.
async function minifiedEsmGzipSize(): Promise<number> {
	const outDir = mkdtempSync(join(tmpdir(), "kizuna-size-"));
	try {
		await build({
			entry: { index: join(repositoryRoot, "src", "index.ts") },
			format: ["esm"],
			minify: true,
			outDir,
			config: false,
			silent: true,
			dts: false,
			sourcemap: false,
			outExtension: () => ({ js: ".mjs" }),
		});
		return gzipSync(readFileSync(join(outDir, "index.mjs"))).length;
	} finally {
		rmSync(outDir, { recursive: true, force: true });
	}
}

function exportTargets(value: unknown): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (value && typeof value === "object") {
		return Object.values(value).flatMap(exportTargets);
	}
	return [];
}

// Returns the JavaScript files that main, module, and the export map publish.
function publishedBundles(): string[] {
	const manifest = JSON.parse(
		readFileSync(join(repositoryRoot, "package.json"), "utf8"),
	) as PackageManifest;
	const targets = [
		manifest.main,
		manifest.module,
		...exportTargets(manifest.exports),
	];
	const bundles = targets
		.filter((target): target is string => target !== undefined)
		.filter((target) => /\.(?:mjs|cjs|js)$/.test(target))
		.map((target) => target.replace(/^\.\//, ""));
	return [...new Set(bundles)].sort();
}

describe("packed package", () => {
	let pack: PackResult;
	let files: string[] = [];

	beforeAll(() => {
		if (!existsSync(join(repositoryRoot, "dist", "index.mjs"))) {
			throw new Error(
				"dist/index.mjs not found. Run `pnpm build` before the package contents tests, " +
					"or run `pnpm test` from CI where build runs first.",
			);
		}
		pack = packPackage();
		files = pack.files.map((file) => file.path);
	});

	it("ships every bundle that package.json publishes", () => {
		const missing = publishedBundles().filter(
			(bundle) => !files.includes(bundle),
		);

		expect(missing).toEqual([]);
	});

	it("ships no other build output than the published bundles, their source maps, and declarations", () => {
		const bundles = publishedBundles();
		const allowed = new Set([
			...bundles,
			...bundles.map((bundle) => `${bundle}.map`),
		]);
		const unexpected = files.filter(
			(path) =>
				path.startsWith("dist/") &&
				!allowed.has(path) &&
				!path.endsWith(".d.ts"),
		);

		expect(unexpected).toEqual([]);
	});

	it("keeps the minified ESM bundle within its gzip budget", async () => {
		const size = await minifiedEsmGzipSize();

		expect(size, `minified ESM gzip: ${size} B`).toBeLessThanOrEqual(
			sizeBudgets.minifiedEsmGzip,
		);
	});

	it("keeps the shipped ESM bundle within its gzip budget", () => {
		const size = gzipSync(
			readFileSync(join(repositoryRoot, "dist", "index.mjs")),
		).length;

		expect(size, `shipped ESM gzip: ${size} B`).toBeLessThanOrEqual(
			sizeBudgets.shippedEsmGzip,
		);
	});

	it("keeps the packed tarball within its budget", () => {
		expect(pack.size, `packed tarball: ${pack.size} B`).toBeLessThanOrEqual(
			sizeBudgets.packedTarball,
		);
	});

	it("keeps the unpacked package within its budget", () => {
		expect(
			pack.unpackedSize,
			`unpacked package: ${pack.unpackedSize} B`,
		).toBeLessThanOrEqual(sizeBudgets.unpackedTarball);
	});

	it("documents each size budget", () => {
		const evidence = readFileSync(
			join(repositoryRoot, "docs", "feature-evidence.md"),
			"utf8",
		);
		const undocumented = Object.values(sizeBudgets)
			.map((budget) => `${budget / KiB} KiB`)
			.filter((budget) => !evidence.includes(`budget ${budget}`));

		expect(undocumented).toEqual([]);
	});
});

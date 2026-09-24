import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

interface PackResult {
	readonly files: readonly { readonly path: string }[];
}

interface PackageManifest {
	readonly main?: string;
	readonly module?: string;
	readonly exports?: unknown;
}

// Reads the file list that npm would publish from the current dist directory.
function packedFiles(): string[] {
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
	return result?.files.map((file) => file.path) ?? [];
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
	let files: string[] = [];

	beforeAll(() => {
		if (!existsSync(join(repositoryRoot, "dist", "index.mjs"))) {
			throw new Error(
				"dist/index.mjs not found. Run `pnpm build` before the package contents tests, " +
					"or run `pnpm test` from CI where build runs first.",
			);
		}
		files = packedFiles();
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
});

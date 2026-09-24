import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

interface PackResult {
	readonly files: readonly { readonly path: string }[];
}

// Reads the file list that npm would publish from the current dist directory.
function packedFiles(): string[] {
	const output = execFileSync(
		"npm",
		["pack", "--dry-run", "--json", "--ignore-scripts"],
		{ cwd: repositoryRoot, encoding: "utf8" },
	);
	const [result] = JSON.parse(output) as PackResult[];
	return result?.files.map((file) => file.path) ?? [];
}

describe("packed package", () => {
	let files: string[] = [];

	beforeAll(() => {
		files = packedFiles();
	});

	it("ships only the bundles that the export map publishes", () => {
		const bundles = files.filter((path) =>
			/\.(?:mjs|cjs)(?:\.map)?$/.test(path),
		);

		expect(bundles.sort()).toEqual([
			"dist/index.cjs",
			"dist/index.cjs.map",
			"dist/index.mjs",
			"dist/index.mjs.map",
		]);
	});

	it("ships no declaration maps that point to unpublished sources", () => {
		const declarationMaps = files.filter((path) => path.endsWith(".d.ts.map"));

		expect(declarationMaps).toEqual([]);
	});
});

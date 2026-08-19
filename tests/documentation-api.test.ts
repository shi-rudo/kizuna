import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function markdownFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			return markdownFiles(path);
		}

		return entry.name.endsWith(".md") ? [path] : [];
	});
}

const publishedMarkdown = [
	join(repositoryRoot, "README.md"),
	join(repositoryRoot, "examples", "README.md"),
	...markdownFiles(join(repositoryRoot, "docs")),
];

const unsupportedCalls = [
	"registerInterface",
	"registerFactory",
	"registerInstance",
	"reset",
] as const;

describe("published TypeScript examples", () => {
	it("do not call APIs that Kizuna does not provide", () => {
		const violations: string[] = [];

		for (const path of publishedMarkdown) {
			const markdown = readFileSync(path, "utf8");
			const codeBlocks = markdown.matchAll(
				/```(?:ts|typescript)\s*\n([\s\S]*?)```/g,
			);

			for (const codeBlock of codeBlocks) {
				const code = codeBlock[1] ?? "";

				for (const method of unsupportedCalls) {
					if (new RegExp(`\\.${method}\\s*\\(`).test(code)) {
						violations.push(`${relative(repositoryRoot, path)}: .${method}()`);
					}
				}
			}
		}

		expect(violations).toEqual([]);
	});
});

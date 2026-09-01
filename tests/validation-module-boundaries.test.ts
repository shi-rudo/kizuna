import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");

describe("validation module boundaries", () => {
	it("keeps lifecycle adaptation outside the registration graph core", () => {
		const snapshotAdapterPath = join(
			repositoryRoot,
			"src",
			"api",
			"registration-snapshots.ts",
		);
		const graphSource = readFileSync(
			join(repositoryRoot, "src", "api", "registration-graph.ts"),
			"utf8",
		);

		expect(existsSync(snapshotAdapterPath)).toBe(true);
		expect(graphSource).not.toContain("ServiceWrapper");
		expect(graphSource).not.toContain("createRegistrationSnapshots");
	});

	it("delegates root exports to the canonical API barrel", () => {
		const rootIndex = readFileSync(
			join(repositoryRoot, "src", "index.ts"),
			"utf8",
		);

		expect(rootIndex).toContain('export * from "./api/index.js";');
		expect(rootIndex).not.toMatch(/export\s+(?:type\s+)?\{/);
	});
});

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");
const benchmarkRoot = join(repositoryRoot, "benchmarks");
const scenarioModulePath = join(benchmarkRoot, "scenarios.ts");

const requiredScenarios = [
	"container-build",
	"cold-resolve",
	"warm-resolve",
	"deep-resolve",
	"start-scope",
	"get-all",
	"sync-dispose",
	"async-dispose",
	"graph-singleton-roots",
	"graph-independent-cycles",
] as const;

const requiredBenchmarkFiles = [
	"container-build.bench.ts",
	"disposal.bench.ts",
	"registration-graph.bench.ts",
	"scope-and-multi.bench.ts",
	"service-resolution.bench.ts",
] as const;

const loadScenarios = async (): Promise<{
	benchmarkScenarios: Readonly<Record<string, readonly number[]>>;
}> => {
	expect(existsSync(scenarioModulePath)).toBe(true);
	return import(/* @vite-ignore */ pathToFileURL(scenarioModulePath).href);
};

describe("benchmark contract", () => {
	it("defines an increasing size series for every required scenario", async () => {
		const { benchmarkScenarios } = await loadScenarios();

		expect(Object.keys(benchmarkScenarios).sort()).toEqual(
			[...requiredScenarios].sort(),
		);
		for (const sizes of Object.values(benchmarkScenarios)) {
			expect(sizes.length).toBeGreaterThanOrEqual(3);
			for (let index = 1; index < sizes.length; index++) {
				expect(sizes[index]).toBeGreaterThan(sizes[index - 1]);
			}
		}
	});

	it("keeps every benchmark scenario connected to an executable benchmark", async () => {
		const { benchmarkScenarios } = await loadScenarios();
		const benchmarkFiles = readdirSync(benchmarkRoot).filter((file) =>
			file.endsWith(".bench.ts"),
		);
		const benchmarkSource = benchmarkFiles
			.map((file) => readFileSync(join(benchmarkRoot, file), "utf8"))
			.join("\n");

		expect(benchmarkFiles.sort()).toEqual([...requiredBenchmarkFiles].sort());
		for (const scenario of Object.keys(benchmarkScenarios)) {
			expect(benchmarkSource).toContain(`scenarioSizes("${scenario}")`);
		}
	});

	it("documents the measurement method and every public operation", () => {
		const readme = readFileSync(join(benchmarkRoot, "README.md"), "utf8");
		const baselinePath = join(benchmarkRoot, "BASELINE.md");

		for (const operation of [
			"Container build",
			"Cold resolve",
			"Warm resolve",
			"Deep resolve",
			"Scope creation",
			"Multi-resolution",
			"Synchronous disposal",
			"Asynchronous disposal",
		]) {
			expect(readme).toContain(operation);
		}
		expect(readme).toContain("pnpm benchmark");
		expect(readme).toContain("Node.js version");
		expect(readme).toContain("`p75`");
		expect(readme).toContain("1.5 times");
		expect(readme).toContain("3.5 times");
		expect(existsSync(baselinePath)).toBe(true);
		if (existsSync(baselinePath)) {
			const baseline = readFileSync(baselinePath, "utf8");
			expect(baseline).toContain("Node.js");
			expect(baseline).toContain("Base commit");
			expect(baseline).toContain("`p75`");
		}
	});

	it("runs benchmark files in sequence", () => {
		const packageJson = JSON.parse(
			readFileSync(join(repositoryRoot, "package.json"), "utf8"),
		) as { scripts?: { benchmark?: string } };

		expect(packageJson.scripts?.benchmark).toContain("--no-file-parallelism");
	});
});

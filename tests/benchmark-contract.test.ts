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

interface BenchmarkCase {
	readonly size: number;
	readonly operationsPerSample: number;
}

const loadScenarios = async (): Promise<{
	benchmarkScenarios: Readonly<Record<string, readonly BenchmarkCase[]>>;
	preparedSampleCount: number;
}> => {
	expect(existsSync(scenarioModulePath)).toBe(true);
	return import(/* @vite-ignore */ pathToFileURL(scenarioModulePath).href);
};

describe("benchmark contract", () => {
	it("defines increasing sizes and measurable batches for every scenario", async () => {
		const { benchmarkScenarios } = await loadScenarios();

		expect(Object.keys(benchmarkScenarios).sort()).toEqual(
			[...requiredScenarios].sort(),
		);
		for (const cases of Object.values(benchmarkScenarios)) {
			expect(cases.length).toBeGreaterThanOrEqual(3);
			for (const benchmarkCase of cases) {
				expect(benchmarkCase.operationsPerSample).toBeGreaterThanOrEqual(1);
			}
			for (let index = 1; index < cases.length; index++) {
				expect(cases[index].size).toBeGreaterThan(cases[index - 1].size);
			}
		}

		for (const scenario of [
			"container-build",
			"cold-resolve",
			"warm-resolve",
			"deep-resolve",
			"start-scope",
			"get-all",
			"sync-dispose",
			"async-dispose",
		] as const) {
			expect(
				benchmarkScenarios[scenario].some(
					(benchmarkCase) => benchmarkCase.operationsPerSample > 1,
				),
			).toBe(true);
		}
	});

	it("uses enough prepared samples to reduce outlier sensitivity", async () => {
		const { preparedSampleCount } = await loadScenarios();

		expect(preparedSampleCount).toBeGreaterThanOrEqual(50);
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
			expect(benchmarkSource).toContain(`scenarioCases("${scenario}")`);
		}
	});

	it("records one baseline row for every scenario case", async () => {
		const { benchmarkScenarios } = await loadScenarios();
		const baseline = readFileSync(join(benchmarkRoot, "BASELINE.md"), "utf8");
		const actualRows = [
			...baseline.matchAll(
				/^\| ([a-z][a-z-]+) \| (\d+) \| (\d+) \| ([0-9]+(?:\.[0-9]+)?) \|$/gm,
			),
		]
			.map((match) => {
				expect(Number(match[4])).toBeGreaterThan(0);
				return `${match[1]}:${match[2]}:${match[3]}`;
			})
			.sort();
		const expectedRows = Object.entries(benchmarkScenarios)
			.flatMap(([scenario, cases]) =>
				cases.map(
					(benchmarkCase) =>
						`${scenario}:${benchmarkCase.size}:${benchmarkCase.operationsPerSample}`,
				),
			)
			.sort();

		expect(actualRows).toEqual(expectedRows);
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
		expect(readme).toContain("Calculate the median");
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

	it("runs the benchmark suite in CI", () => {
		const workflow = readFileSync(
			join(repositoryRoot, ".github/workflows/ci.yml"),
			"utf8",
		);

		expect(workflow).toContain("run: pnpm benchmark");
	});
});

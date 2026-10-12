import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const read = (...path: string[]): string =>
	readFileSync(join(repositoryRoot, ...path), "utf8");

type Version = readonly [number, number, number];

// Returns the lowest version that a setup-node spec such as `22.12.x` allows.
function lowestVersion(spec: string): Version {
	const [major = 0, minor = 0, patch = 0] = spec
		.replace(/['"]/g, "")
		.split(".")
		.map((part) => (part === "x" ? 0 : Number(part)));
	return [major, minor, patch];
}

function compareVersions(a: Version, b: Version): number {
	return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

// Returns every fixed node-version value of a workflow, matrix entries included.
function workflowNodeVersions(file: string): string[] {
	const workflow = read(".github", "workflows", file);
	return [...workflow.matchAll(/node-version:\s*(\[[^\]]*\]|\S+)/g)]
		.map((match) => match[1] ?? "")
		.filter((value) => !value.includes("${{"))
		.flatMap((value) => value.replace(/[[\]]/g, "").split(","))
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

function ciMatrixVersions(): string[] {
	const ci = read(".github", "workflows", "ci.yml");
	const matrix = /node-version:\s*\[([^\]]*)\]/.exec(ci)?.[1] ?? "";
	return matrix.split(",").map((value) => value.trim());
}

function testedFloor(): Version {
	const [floor] = ciMatrixVersions().map(lowestVersion).sort(compareVersions);
	if (!floor) {
		throw new Error("The CI workflow has no Node.js matrix.");
	}
	return floor;
}

describe("Node.js support", () => {
	it("declares the lowest Node.js version that the CI matrix tests", () => {
		const manifest = JSON.parse(read("package.json")) as {
			engines?: { node?: string };
		};

		expect(manifest.engines?.node).toBe(`>=${testedFloor().join(".")}`);
	});

	it("runs every workflow on a Node.js version that the package supports", () => {
		const floor = testedFloor();
		const unsupported = ["ci.yml", "e2e.yml", "release.yml"].flatMap((file) =>
			workflowNodeVersions(file)
				.filter((spec) => compareVersions(lowestVersion(spec), floor) < 0)
				.map((spec) => `${file}: ${spec}`),
		);

		expect(unsupported).toEqual([]);
	});

	it("names every tested Node.js version in the README and the evidence matrix", () => {
		const documents = {
			"README.md": read("README.md"),
			"docs/feature-evidence.md": read("docs", "feature-evidence.md"),
		};
		const missing = Object.entries(documents).flatMap(([name, text]) =>
			ciMatrixVersions()
				.filter((version) => !text.includes(`\`${version}\``))
				.map((version) => `${name}: ${version}`),
		);

		expect(missing).toEqual([]);
	});
});

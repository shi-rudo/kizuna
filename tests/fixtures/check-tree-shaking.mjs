import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Checks the bundle of tree-shaking-consumer.js. It must keep the consumer
// code and drop every part of Kizuna that the consumer does not use.

/** Strings that minification keeps, one for each part the consumer does not use. */
export const unusedParts = {
	container: "KizunaRootServiceContainer",
	resolution: "Cannot resolve disposed service",
	diagnostics: "containerBuilt",
	validation: "CONTAINER_VALIDATION_FAILED",
	borrowing: "SINGLETON_BORROW_FAILED",
};

export const byteLimit = 1024;

/** Returns every problem of a consumer bundle, or an empty list. */
export function findTreeShakingProblems(bundle) {
	const problems = [];
	if (!bundle.includes("clock")) {
		problems.push("The bundle does not contain the consumer code.");
	}
	// A kept import means the bundler did not inline Kizuna, so nothing was shaken.
	if (/["']@shirudo\/kizuna["']/.test(bundle)) {
		problems.push(
			"The bundle still imports @shirudo/kizuna instead of bundling it.",
		);
	}
	const keptParts = Object.entries(unusedParts)
		.filter(([, marker]) => bundle.includes(marker))
		.map(([part]) => part);
	if (keptParts.length > 0) {
		problems.push(
			`The bundle keeps unused Kizuna code: ${keptParts.join(", ")}.`,
		);
	}
	const bytes = Buffer.byteLength(bundle);
	if (bytes > byteLimit) {
		problems.push(`The bundle has ${bytes} bytes. The limit is ${byteLimit}.`);
	}
	return problems;
}

/** Reads every JavaScript file that a build wrote to `outDir`, chunks included. */
export function readBundle(outDir) {
	return readdirSync(outDir, { recursive: true })
		.map(String)
		.filter((file) => file.endsWith(".js"))
		.map((file) => readFileSync(join(outDir, file), "utf8"))
		.join("\n");
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const bundle = readBundle("dist-tree-shaking");
	const problems = findTreeShakingProblems(bundle);
	if (problems.length > 0) {
		console.error(problems.join("\n"));
		process.exit(1);
	}
	console.log(
		`Tree shaking kept ${Buffer.byteLength(bundle)} bytes for an interfaceToken consumer.`,
	);
}

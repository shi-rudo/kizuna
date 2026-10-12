import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Checks the bundle of tree-shaking-consumer.js. It must keep the interface
// token call and drop every other part of Kizuna.
const outDir = "dist-tree-shaking";
const bundle = readdirSync(outDir)
	.filter((file) => file.endsWith(".js"))
	.map((file) => readFileSync(join(outDir, file), "utf8"))
	.join("\n");
const bytes = Buffer.byteLength(bundle);

// Strings that minification keeps, one for each part the consumer does not use.
const unusedParts = {
	container: "KizunaRootServiceContainer",
	resolution: "Cannot resolve disposed service",
	diagnostics: "containerBuilt",
	validation: "CONTAINER_VALIDATION_FAILED",
	borrowing: "SINGLETON_BORROW_FAILED",
};
const byteLimit = 1024;

const problems = [];
if (!bundle.includes("clock")) {
	problems.push("The bundle does not contain the interface token call.");
}
const keptParts = Object.entries(unusedParts)
	.filter(([, marker]) => bundle.includes(marker))
	.map(([part]) => part);
if (keptParts.length > 0) {
	problems.push(
		`The bundle keeps unused Kizuna code: ${keptParts.join(", ")}.`,
	);
}
if (bytes > byteLimit) {
	problems.push(`The bundle has ${bytes} bytes. The limit is ${byteLimit}.`);
}

if (problems.length > 0) {
	console.error(problems.join("\n"));
	process.exit(1);
}
console.log(`Tree shaking kept ${bytes} bytes for an interfaceToken consumer.`);

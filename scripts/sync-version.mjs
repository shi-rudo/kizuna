import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const packagePath = resolve(root, "package.json");
const jsrPath = resolve(root, "jsr.json");

const [packageSource, jsrSource] = await Promise.all([
	readFile(packagePath, "utf8"),
	readFile(jsrPath, "utf8"),
]);

const packageJson = JSON.parse(packageSource);
const jsrJson = JSON.parse(jsrSource);

if (
	typeof packageJson.version !== "string" ||
	packageJson.version.length === 0
) {
	throw new Error("package.json must contain a version.");
}

if (jsrJson.version === packageJson.version) {
	process.exit(0);
}

const indent = jsrSource.match(/^[\t ]+(?=")/m)?.[0] ?? "\t";
jsrJson.version = packageJson.version;

await writeFile(jsrPath, `${JSON.stringify(jsrJson, null, indent)}\n`, "utf8");

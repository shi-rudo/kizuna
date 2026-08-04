import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { assertReleaseState } from "./release-state.mjs";

const executeFile = promisify(execFile);
const wait = (milliseconds) =>
	new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

export const runVerifyCommand = async ({
	root = process.cwd(),
	published = process.env.PUBLISHED ?? "false",
	publishedPackages = process.env.PUBLISHED_PACKAGES ?? "[]",
	execute = executeFile,
	log = console.log,
	waitForRetry = wait,
	maxAttempts = 6,
} = {}) => {
	const [packageJson, jsrJson] = await Promise.all([
		readJson(resolve(root, "package.json")),
		readJson(resolve(root, "jsr.json")),
	]);
	const packageName = packageJson.name;
	const packageVersion = packageJson.version;
	const workflowPublished = published === "true";
	const workflowPackages = JSON.parse(publishedPackages.trim() || "[]");

	if (
		typeof packageName !== "string" ||
		typeof packageVersion !== "string" ||
		typeof jsrJson.version !== "string"
	) {
		throw new Error("package.json and jsr.json must contain release metadata.");
	}

	if (!Array.isArray(workflowPackages)) {
		throw new Error("PUBLISHED_PACKAGES must contain a JSON array.");
	}

	const attempts = workflowPublished ? maxAttempts : 1;
	let lastError;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const [{ stdout: versionOutput }, { stdout: distTagsOutput }] =
				await Promise.all([
					execute(
						"npm",
						["view", `${packageName}@${packageVersion}`, "version", "--json"],
						{ cwd: root },
					),
					execute("npm", ["view", packageName, "dist-tags", "--json"], {
						cwd: root,
					}),
				]);
			const npmVersion = JSON.parse(versionOutput);
			const distTags = JSON.parse(distTagsOutput);
			const { targetDistTag } = assertReleaseState({
				packageName,
				packageVersion,
				jsrVersion: jsrJson.version,
				npmVersion,
				distTags,
				published: workflowPublished,
				publishedPackages: workflowPackages,
			});

			log(
				`Verified ${packageName}@${packageVersion} on npm with dist-tag ${targetDistTag}.`,
			);
			return;
		} catch (error) {
			lastError = error;

			if (attempt < attempts) {
				await waitForRetry(5_000);
			}
		}
	}

	throw new Error(
		`Could not verify ${packageName}@${packageVersion} on npm after ${attempts} attempt${attempts === 1 ? "" : "s"}.`,
		{ cause: lastError },
	);
};

const isMainModule =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
	try {
		await runVerifyCommand();
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
}

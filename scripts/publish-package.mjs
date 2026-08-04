import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { getTargetDistTag } from "./release-state.mjs";

const executeFile = promisify(execFile);

export const publishPackage = async ({
	packageName,
	packageVersion,
	isPublished,
	publish,
}) => {
	const distTag = getTargetDistTag(packageVersion);

	if (await isPublished()) {
		return {
			published: false,
			distTag,
			packageName,
			packageVersion,
		};
	}

	await publish(distTag);

	return {
		published: true,
		distTag,
		packageName,
		packageVersion,
	};
};

const errorOutput = (error) =>
	[error?.message, error?.stdout, error?.stderr]
		.filter(Boolean)
		.map(String)
		.join("\n");

export const runPublishCommand = async ({
	root = process.cwd(),
	execute = executeFile,
	log = console.log,
} = {}) => {
	const packageJson = JSON.parse(
		await readFile(resolve(root, "package.json"), "utf8"),
	);
	const { name: packageName, version: packageVersion } = packageJson;

	if (typeof packageName !== "string" || typeof packageVersion !== "string") {
		throw new Error("package.json must contain a package name and version.");
	}

	const selector = `${packageName}@${packageVersion}`;
	const result = await publishPackage({
		packageName,
		packageVersion,
		isPublished: async () => {
			try {
				const { stdout } = await execute(
					"npm",
					["view", selector, "version", "--json"],
					{ cwd: root },
				);

				return JSON.parse(stdout) === packageVersion;
			} catch (error) {
				if (/\bE404\b/.test(errorOutput(error))) {
					return false;
				}

				throw new Error(`Could not read ${selector} from npm.`, {
					cause: error,
				});
			}
		},
		publish: async (distTag) => {
			await execute(
				"npm",
				[
					"publish",
					"--access",
					"public",
					"--tag",
					distTag,
					"--provenance",
					"--json",
				],
				{ cwd: root },
			);
		},
	});

	if (result.published) {
		log(`New tag: ${selector}`);
	} else {
		log(`${selector} is already published.`);
	}

	return result;
};

const isMainModule =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
	try {
		await runPublishCommand();
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
}

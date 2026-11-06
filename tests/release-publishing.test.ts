import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	publishPackage,
	runPublishCommand,
} from "../scripts/publish-package.mjs";
import {
	assertReleaseState,
	getTargetDistTag,
} from "../scripts/release-state.mjs";
import { runVerifyCommand } from "../scripts/verify-release.mjs";

/**
 * A registry that shows a published version only after `visibleAfterMs` of
 * waiting. The waits advance a virtual clock instead of sleeping.
 */
const delayedRegistry = (version: string, visibleAfterMs: number) => {
	let elapsedMs = 0;
	return {
		get elapsedMs() {
			return elapsedMs;
		},
		waitForRetry: async (milliseconds: number) => {
			elapsedMs += milliseconds;
		},
		execute: async (_command: string, args: string[]) => {
			if (elapsedMs < visibleAfterMs) {
				throw Object.assign(new Error("Command failed: npm view"), {
					stderr: "npm error code E404",
				});
			}
			return {
				stdout:
					args[2] === "dist-tags"
						? JSON.stringify({ latest: "0.0.15", rc: version })
						: JSON.stringify(version),
				stderr: "",
			};
		},
	};
};

const withReleaseRoot = async (
	version: string,
	action: (root: string) => Promise<void>,
): Promise<void> => {
	const root = mkdtempSync(join(tmpdir(), "kizuna-verify-delay-"));
	try {
		for (const file of ["package.json", "jsr.json"]) {
			writeFileSync(
				join(root, file),
				JSON.stringify({ name: "@shirudo/kizuna", version }),
			);
		}
		await action(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

const publishedOutputs = (version: string) => ({
	published: "true",
	publishedPackages: JSON.stringify([{ name: "@shirudo/kizuna", version }]),
});

describe("Release verification after a publication", () => {
	it("waits until npm shows a version that appears after 77 seconds", async () => {
		await withReleaseRoot("1.0.0-rc.10", async (root) => {
			const registry = delayedRegistry("1.0.0-rc.10", 77_000);

			const verification = runVerifyCommand({
				root,
				...publishedOutputs("1.0.0-rc.10"),
				execute: registry.execute,
				waitForRetry: registry.waitForRetry,
				log: () => undefined,
			});

			await expect(verification).resolves.toBeUndefined();
		});
	});

	it("gives up after five minutes when npm never shows the version", async () => {
		await withReleaseRoot("1.0.0-rc.10", async (root) => {
			const registry = delayedRegistry("1.0.0-rc.10", Number.POSITIVE_INFINITY);

			const verification = runVerifyCommand({
				root,
				...publishedOutputs("1.0.0-rc.10"),
				execute: registry.execute,
				waitForRetry: registry.waitForRetry,
				log: () => undefined,
			});

			await expect(verification).rejects.toThrow(
				"Could not verify @shirudo/kizuna@1.0.0-rc.10 on npm",
			);
			expect(registry.elapsedMs).toBe(300_000);
		});
	});

	it("does not wait when the workflow published nothing", async () => {
		await withReleaseRoot("1.0.0-rc.10", async (root) => {
			const registry = delayedRegistry("1.0.0-rc.10", Number.POSITIVE_INFINITY);

			const verification = runVerifyCommand({
				root,
				published: "false",
				publishedPackages: "[]",
				execute: registry.execute,
				waitForRetry: registry.waitForRetry,
				log: () => undefined,
			});

			await expect(verification).rejects.toThrow();
			expect(registry.elapsedMs).toBe(0);
		});
	});
});

describe("Release publishing", () => {
	it("maps supported versions to explicit npm dist-tags", () => {
		expect(getTargetDistTag("1.0.0-rc.8")).toBe("rc");
		expect(getTargetDistTag("1.0.0")).toBe("latest");
		expect(() => getTargetDistTag("1.0.0-beta.1")).toThrow(
			"Unsupported prerelease version",
		);
	});

	it("reconciles package metadata, npm, and the workflow result", () => {
		const release = {
			packageName: "@shirudo/kizuna",
			packageVersion: "1.0.0-rc.8",
			jsrVersion: "1.0.0-rc.8",
			npmVersion: "1.0.0-rc.8",
			distTags: { latest: "0.0.15", rc: "1.0.0-rc.8" },
			published: true,
			publishedPackages: [{ name: "@shirudo/kizuna", version: "1.0.0-rc.8" }],
		};

		expect(() => assertReleaseState(release)).not.toThrow();

		expect(() =>
			assertReleaseState({
				...release,
				jsrVersion: "1.0.0-rc.7",
				npmVersion: "1.0.0-rc.7",
				distTags: { latest: "0.0.15", rc: "1.0.0-rc.7" },
				publishedPackages: [],
			}),
		).toThrowError(
			/.*jsr\.json.*\n.*npm version.*\n.*npm dist-tag.*\n.*workflow output.*/s,
		);
	});

	it("publishes an unpublished version with its target dist-tag", async () => {
		const publishCalls: string[] = [];

		const result = await publishPackage({
			packageName: "@shirudo/kizuna",
			packageVersion: "1.0.0-rc.8",
			isPublished: async () => false,
			publish: async (distTag: string) => publishCalls.push(distTag),
		});

		expect(result).toEqual({
			published: true,
			distTag: "rc",
			packageName: "@shirudo/kizuna",
			packageVersion: "1.0.0-rc.8",
		});
		expect(publishCalls).toEqual(["rc"]);
	});

	it("does not publish a version that already exists", async () => {
		const result = await publishPackage({
			packageName: "@shirudo/kizuna",
			packageVersion: "1.0.0",
			isPublished: async () => true,
			publish: async () => {
				throw new Error("publish must not run");
			},
		});

		expect(result).toMatchObject({ published: false, distTag: "latest" });
	});

	it("uses npm CLI so trusted publishing can create provenance", async () => {
		const root = mkdtempSync(join(tmpdir(), "kizuna-publish-"));
		const calls: string[][] = [];
		const commands: string[] = [];
		const logs: string[] = [];

		try {
			writeFileSync(
				join(root, "package.json"),
				JSON.stringify({ name: "@shirudo/kizuna", version: "1.0.0-rc.8" }),
			);

			await runPublishCommand({
				root,
				execute: async (command: string, args: string[]) => {
					commands.push(command);
					calls.push(args);

					if (args[0] === "view") {
						throw Object.assign(new Error("Not found"), {
							stderr: "npm error code E404",
						});
					}

					return { stdout: "{}", stderr: "" };
				},
				log: (message: string) => logs.push(message),
			});

			expect(calls).toEqual([
				["view", "@shirudo/kizuna@1.0.0-rc.8", "version", "--json"],
				[
					"publish",
					"--access",
					"public",
					"--tag",
					"rc",
					"--provenance",
					"--json",
				],
				["tag", "v1.0.0-rc.8"],
			]);
			expect(commands).toEqual(["npm", "npm", "git"]);
			expect(logs).toContain("New tag: @shirudo/kizuna@1.0.0-rc.8");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("verifies the published package against npm", async () => {
		const root = mkdtempSync(join(tmpdir(), "kizuna-verify-"));
		const calls: string[][] = [];
		const logs: string[] = [];

		try {
			writeFileSync(
				join(root, "package.json"),
				JSON.stringify({ name: "@shirudo/kizuna", version: "1.0.0-rc.8" }),
			);
			writeFileSync(
				join(root, "jsr.json"),
				JSON.stringify({ name: "@shirudo/kizuna", version: "1.0.0-rc.8" }),
			);

			await runVerifyCommand({
				root,
				published: "true",
				publishedPackages: JSON.stringify([
					{ name: "@shirudo/kizuna", version: "1.0.0-rc.8" },
				]),
				execute: async (_command: string, args: string[]) => {
					calls.push(args);

					return {
						stdout:
							args[2] === "dist-tags"
								? JSON.stringify({ latest: "0.0.15", rc: "1.0.0-rc.8" })
								: JSON.stringify("1.0.0-rc.8"),
						stderr: "",
					};
				},
				log: (message: string) => logs.push(message),
			});

			expect(calls).toEqual([
				["view", "@shirudo/kizuna@1.0.0-rc.8", "version", "--json"],
				["view", "@shirudo/kizuna", "dist-tags", "--json"],
			]);
			expect(logs).toContain(
				"Verified @shirudo/kizuna@1.0.0-rc.8 on npm with dist-tag rc.",
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("accepts empty action outputs when the current version is already published", async () => {
		const root = mkdtempSync(join(tmpdir(), "kizuna-verify-existing-"));

		try {
			writeFileSync(
				join(root, "package.json"),
				JSON.stringify({ name: "@shirudo/kizuna", version: "1.0.0" }),
			);
			writeFileSync(
				join(root, "jsr.json"),
				JSON.stringify({ name: "@shirudo/kizuna", version: "1.0.0" }),
			);

			await expect(
				runVerifyCommand({
					root,
					published: "",
					publishedPackages: "",
					execute: async (_command: string, args: string[]) => ({
						stdout:
							args[2] === "dist-tags"
								? JSON.stringify({ latest: "1.0.0" })
								: JSON.stringify("1.0.0"),
						stderr: "",
					}),
					log: () => undefined,
				}),
			).resolves.toBeUndefined();
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});

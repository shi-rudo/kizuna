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
			]);
			expect(commands).toEqual(["npm", "npm"]);
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

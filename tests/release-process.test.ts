import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readText = (relativePath: string) =>
	readFileSync(new URL(relativePath, import.meta.url), "utf8");

const readJson = (relativePath: string) => JSON.parse(readText(relativePath));

const semVerPattern =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

describe("Release process", () => {
	it("uses a valid Semantic Version", () => {
		const pkg = readJson("../package.json");

		expect(pkg.version).toMatch(semVerPattern);
	});

	it("configures Changesets for the public package", () => {
		const config = readJson("../.changeset/config.json");

		expect(config).toMatchObject({
			changelog: "@changesets/cli/changelog",
			commit: false,
			access: "public",
			baseBranch: "main",
		});
	});

	it("keeps release entries directly below the changelog heading", () => {
		const lines = readText("../CHANGELOG.md")
			.split("\n")
			.filter((line) => line.trim().length > 0);

		expect(lines[0]).toBe("# Changelog");
		expect(lines[1]).toMatch(/^## /);
	});

	it("matches the package version to the configured release channel", () => {
		const pkg = readJson("../package.json");
		const prereleaseUrl = new URL("../.changeset/pre.json", import.meta.url);

		if (!existsSync(prereleaseUrl)) {
			expect(pkg.version).not.toContain("-");
			return;
		}

		const prerelease = JSON.parse(readFileSync(prereleaseUrl, "utf8"));
		const initialVersion = prerelease.initialVersions[pkg.name];

		expect(prerelease).toMatchObject({
			mode: "pre",
			tag: "rc",
		});
		expect(initialVersion).toMatch(semVerPattern);
		expect(pkg.version).toMatch(/-rc\.(0|[1-9]\d*)$/);
	});

	it("provides explicit version and release commands", () => {
		const pkg = readJson("../package.json");

		expect(pkg.devDependencies["@changesets/cli"]).toBeDefined();
		expect(pkg.scripts).toMatchObject({
			changeset: "changeset",
			"sync-version": "node scripts/sync-version.mjs",
			"version-packages": "changeset version && pnpm sync-version",
			release: "pnpm build && node scripts/publish-package.mjs",
		});
	});

	it("synchronizes jsr.json without changing other fields", () => {
		const root = mkdtempSync(join(tmpdir(), "kizuna-version-"));
		const script = fileURLToPath(
			new URL("../scripts/sync-version.mjs", import.meta.url),
		);

		try {
			writeFileSync(
				join(root, "package.json"),
				JSON.stringify({ name: "@shirudo/kizuna", version: "2.3.0" }),
			);
			writeFileSync(
				join(root, "jsr.json"),
				`${JSON.stringify({ name: "@shirudo/kizuna", version: "2.2.0", exports: "./mod.ts" }, null, 4)}\n`,
			);

			execFileSync(process.execPath, [script], { cwd: root });

			expect(JSON.parse(readFileSync(join(root, "jsr.json"), "utf8"))).toEqual({
				name: "@shirudo/kizuna",
				version: "2.3.0",
				exports: "./mod.ts",
			});
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("creates version pull requests and publishes releases with npm OIDC", () => {
		const workflow = readText("../.github/workflows/release.yml");

		expect(workflow).toContain("workflow_dispatch:");
		expect(workflow).toContain("uses: changesets/action@");
		expect(workflow).toContain("version: pnpm version-packages");
		expect(workflow).toContain("publish: pnpm release");
		expect(workflow).toContain("id-token: write");
		expect(workflow).toContain("run: node scripts/verify-release.mjs");
		expect(workflow).toContain(
			"PUBLISHED: $" + "{{ steps.changesets.outputs.published }}",
		);
		expect(workflow).toContain(
			"PUBLISHED_PACKAGES: $" +
				"{{ steps.changesets.outputs.publishedPackages }}",
		);
	});

	it("binds the npm identity to a protected GitHub environment", () => {
		const workflow = readText("../.github/workflows/release.yml");
		const guide = readText("../docs/releases.md");

		expect(workflow).toContain("    environment:\n      name: npm");
		expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
		expect(guide).toContain("- Environment: `npm`");
		expect(guide).toContain("allows only the `main` branch");
	});

	it("documents publication targets, npm setup, and emergency recovery", () => {
		const guide = readText("../docs/releases.md");

		expect(guide).toContain("The automated publication target is npm only.");
		expect(guide).toContain("JSR is not an automated publication target");
		expect(guide).toContain("Workflow filename: `release.yml`");
		expect(guide).toContain("Allowed action: `npm publish`");
		expect(guide).toContain("## Emergency publication");
		expect(guide).toContain(
			'npm view "@shirudo/kizuna@$release_version" version',
		);
		expect(guide).toContain("npm view @shirudo/kizuna dist-tags");
	});
});

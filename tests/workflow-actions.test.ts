import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const approvedNode24Revisions: Record<string, string> = {
	"actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1",
	"actions/setup-node": "820762786026740c76f36085b0efc47a31fe5020",
	"changesets/action": "a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d",
	"pnpm/action-setup": "0977fd99725f1db4007ccb2928dbb4e90d06cc86",
};

const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
const workflowFiles = readdirSync(workflowDirectory).filter(
	(file) => file.endsWith(".yml") || file.endsWith(".yaml"),
);

describe("GitHub Actions workflows", () => {
	it("pins every action to an approved Node 24 revision", () => {
		for (const file of workflowFiles) {
			const workflow = readFileSync(new URL(file, workflowDirectory), "utf8");
			const actions = workflow.matchAll(
				/^\s*uses:\s+([^/\s]+\/[^@\s]+)@([^\s#]+)/gm,
			);

			for (const [, action, revision] of actions) {
				expect(revision, `${file}: ${action}`).toMatch(/^[0-9a-f]{40}$/);
				expect(revision, `${file}: ${action}`).toBe(
					approvedNode24Revisions[action],
				);
			}
		}
	});

	it("uses packageManager as the single pnpm version source", () => {
		const pkg = JSON.parse(
			readFileSync(new URL("../package.json", import.meta.url), "utf8"),
		);

		expect(pkg.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);

		for (const file of workflowFiles) {
			const workflow = readFileSync(new URL(file, workflowDirectory), "utf8");

			expect(workflow, file).not.toMatch(
				/uses:\s+pnpm\/action-setup@[^\n]+\n\s+with:\n\s+version:/,
			);
		}
	});
});

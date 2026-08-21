import { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function markdownFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			return markdownFiles(path);
		}

		return entry.name.endsWith(".md") ? [path] : [];
	});
}

const publishedMarkdown = [
	join(repositoryRoot, "README.md"),
	join(repositoryRoot, "examples", "README.md"),
	...markdownFiles(join(repositoryRoot, "docs")),
];

const removedCallsFromAudit = [
	"registerInterface",
	"registerFactory",
	"registerInstance",
	"reset",
] as const;

function codeBlockAfter(markdown: string, heading: string): string {
	const headingIndex = markdown.indexOf(heading);
	if (headingIndex < 0) {
		throw new Error(`Missing documentation heading: ${heading}`);
	}

	const codeBlock = /```typescript\s*\n([\s\S]*?)```/.exec(
		markdown.slice(headingIndex),
	);
	if (!codeBlock?.[1]) {
		throw new Error(`Missing TypeScript block after: ${heading}`);
	}

	return codeBlock[1];
}

function strictTypeErrors(source: string): string[] {
	const directory = mkdtempSync(join(repositoryRoot, ".kizuna-doc-example-"));
	const fileName = join(directory, "advanced-request-scope.ts");
	writeFileSync(fileName, source);

	try {
		const result = spawnSync(
			process.execPath,
			[
				join(repositoryRoot, "node_modules", "typescript", "bin", "tsc"),
				"--ignoreConfig",
				"--module",
				"esnext",
				"--moduleResolution",
				"bundler",
				"--noEmit",
				"--skipLibCheck",
				"--strict",
				"--target",
				"esnext",
				fileName,
			],
			{ cwd: directory, encoding: "utf8" },
		);
		if (result.status === 0) {
			return [];
		}

		return [`${result.stdout}${result.stderr}`.trim()];
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
}

describe("published TypeScript examples", () => {
	it("do not reintroduce removed calls from the documentation audit", () => {
		const violations: string[] = [];

		for (const path of publishedMarkdown) {
			const markdown = readFileSync(path, "utf8");
			const codeBlocks = markdown.matchAll(
				/```(?:ts|typescript)\s*\n([\s\S]*?)```/g,
			);

			for (const codeBlock of codeBlocks) {
				const code = codeBlock[1] ?? "";

				for (const method of removedCallsFromAudit) {
					if (new RegExp(`\\.${method}\\s*\\(`).test(code)) {
						violations.push(`${relative(repositoryRoot, path)}: .${method}()`);
					}
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it("keeps the advanced request-scope example type-safe", () => {
		const markdown = readFileSync(
			join(repositoryRoot, "docs", "concurrency-patterns.md"),
			"utf8",
		);
		const example = codeBlockAfter(
			markdown,
			"### Advanced Request Scope Pattern:",
		);
		const source = `
import { ContainerBuilder } from "../src";

class Logger {}
class Database {
    constructor(readonly logger: Logger) {}
}
class UserService {
    constructor(
        readonly database: Database,
        readonly logger: Logger,
    ) {}
}

const rootContainer = new ContainerBuilder()
    .registerSingleton("Logger", Logger)
    .registerSingleton("Database", Database, "Logger")
    .registerScoped("UserService", UserService, "Database", "Logger")
    .build();

interface RequestContext {
    requestId: string;
    userId: string | undefined;
    requestTime: number;
}
interface ExampleRequest {
    headers: Record<string, string | string[] | undefined>;
    requestContext: RequestContext;
    services: ReturnType<typeof rootContainer.startScope>;
}
interface ExampleResponse {
    once(event: "close", callback: () => void): void;
}
declare const app: {
    use(callback: (
        request: ExampleRequest,
        response: ExampleResponse,
        next: () => void,
    ) => void): void;
};
declare function generateId(): string;

${example}
`;

		expect(strictTypeErrors(source)).toEqual([]);
	});

	it("keeps the multiple-container README example type-safe", () => {
		const markdown = readFileSync(join(repositoryRoot, "README.md"), "utf8");
		const example = codeBlockAfter(
			markdown,
			"### 🌍 **Multiple Containers for Domain Separation**",
		);
		const source = `
import { ContainerBuilder, interfaceToken } from "../src";

interface IConfig {}
class Logger {}
class EmailService {
    constructor(readonly logger: Logger) {}
}
class DatabaseConfig implements IConfig {}
class UserService {
    constructor(readonly logger: Logger) {}
}
class UserNotificationService {
    constructor(readonly emailService: EmailService) {}
}
class OrderService {
    constructor(readonly logger: Logger) {}
}
class PaymentService {
    constructor(readonly logger: Logger) {}
}

${example}
`;

		expect(strictTypeErrors(source)).toEqual([]);
	});

	it("does not pass factories to constructor registration methods", () => {
		const violations: string[] = [];
		const factoryPassedToConstructorRegistration =
			/\.register(?:Singleton|Scoped|Transient)\s*\(\s*[^,]+,\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g;

		for (const path of publishedMarkdown) {
			const markdown = readFileSync(path, "utf8");
			for (const match of markdown.matchAll(
				/```(?:ts|typescript)\s*\n([\s\S]*?)```/g,
			)) {
				const code = match[1] ?? "";
				if (factoryPassedToConstructorRegistration.test(code)) {
					violations.push(relative(repositoryRoot, path));
				}
				factoryPassedToConstructorRegistration.lastIndex = 0;
			}
		}

		expect(violations).toEqual([]);
	});

	it("does not claim that containers enforce domain boundaries", () => {
		const example = readFileSync(
			join(
				repositoryRoot,
				"examples",
				"multiple-containers-domain-separation.ts",
			),
			"utf8",
		);

		expect(example).not.toMatch(
			/Prevents cross-domain dependencies|Clear domain boundaries/,
		);
	});
});

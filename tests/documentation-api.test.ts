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
	...markdownFiles(join(repositoryRoot, "skills")),
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

function normalizedMarkdown(markdown: string): string {
	return markdown.replace(/\s+/g, " ");
}

function strictTypeErrors(source: string, exampleName = "example"): string[] {
	const directory = mkdtempSync(join(repositoryRoot, ".kizuna-doc-example-"));
	const fileName = join(directory, `${exampleName}.ts`);
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

function containsCombinedDisposalExample(markdown: string): boolean {
	const codeBlocks = markdown.matchAll(
		/```(?:ts|typescript)\s*\n([\s\S]*?)```/g,
	);

	return [...codeBlocks].some((codeBlock) => {
		const code = codeBlock[1] ?? "";
		return /\.dispose\(\)/.test(code) && /\.disposeAsync\(\)/.test(code);
	});
}

describe("published TypeScript examples", () => {
	it("keeps Quick Start dependency keys aligned with constructor parameters", () => {
		const readme = readFileSync(join(repositoryRoot, "README.md"), "utf8");
		const quickStart = codeBlockAfter(readme, "## 🚀 Quick Start");
		const source = quickStart.replace(
			"from '@shirudo/kizuna'",
			'from "../src"',
		);

		expect(quickStart).toContain("constructor(private logger: Logger)");
		expect(quickStart).toContain(
			"constructor(private db: DatabaseService, private logger: Logger)",
		);
		expect(quickStart).toContain(".registerSingleton('logger', Logger)");
		expect(quickStart).toContain(
			".registerSingleton('db', DatabaseService, 'logger')",
		);
		expect(quickStart).toContain(
			".registerScoped('userService', UserService, 'db', 'logger')",
		);
		expect(strictTypeErrors(source, "quick-start")).toEqual([]);
	});

	it("states that constructor dependency keys are positional", () => {
		const readme = readFileSync(join(repositoryRoot, "README.md"), "utf8");

		expect(readme).toContain("Dependency keys are positional.");
		expect(readme).toMatch(
			/The first key provides the first constructor\s+parameter\./,
		);
	});

	it("detects combined disposal calls without semicolons", () => {
		const example = [
			"```typescript",
			"container.dispose()",
			"await container.disposeAsync()",
			"```",
		].join("\n");

		expect(containsCombinedDisposalExample(example)).toBe(true);
	});

	it("allows separate synchronous and asynchronous disposal examples", () => {
		const alternatives = [
			"```typescript",
			"container.dispose();",
			"```",
			"```typescript",
			"await container.disposeAsync();",
			"```",
		].join("\n");

		expect(containsCombinedDisposalExample(alternatives)).toBe(false);
	});

	it("presents synchronous and asynchronous disposal as alternatives", () => {
		const readme = readFileSync(join(repositoryRoot, "README.md"), "utf8");
		const disposal = readme.slice(
			readme.indexOf("### 🧹 **Disposal**"),
			readme.indexOf("## 🏗️ Advanced Patterns"),
		);

		expect(disposal).toContain("Choose one disposal API for each container.");
		expect(containsCombinedDisposalExample(disposal)).toBe(false);
	});

	it("lists singleton borrowing in the formal builder API", () => {
		const readme = readFileSync(join(repositoryRoot, "README.md"), "utf8");
		const formalApi = readme.slice(
			readme.indexOf("### ContainerBuilder"),
			readme.indexOf("### RootServiceContainer and TypeSafeServiceLocator"),
		);

		expect(formalApi).toContain("#### Cross-Container Composition");
		expect(formalApi).toContain(".borrowSingletonFrom<");
	});

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

		expect(strictTypeErrors(source, "advanced-request-scope")).toEqual([]);
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

		expect(strictTypeErrors(source, "multiple-containers")).toEqual([]);
	});

	it("keeps the packaged skill borrowing examples type-safe", () => {
		const skill = readFileSync(
			join(repositoryRoot, "skills", "kizuna", "SKILL.md"),
			"utf8",
		);
		const skillExample = codeBlockAfter(
			skill,
			"### Borrow a singleton from another container",
		);
		const reference = readFileSync(
			join(
				repositoryRoot,
				"skills",
				"kizuna",
				"references",
				"registration-patterns.md",
			),
			"utf8",
		);
		const referenceExample = codeBlockAfter(reference, "## Borrowed singleton");
		const declarations = `
class Logger {
    log(_message: string): void {}
}
class MetricsCollector {
    increment(_name: string): void {}
}
class UserService {
    constructor(..._dependencies: unknown[]) {}
}
`;

		expect(
			strictTypeErrors(
				`${declarations}\n${skillExample}`,
				"skill-borrowed-singleton",
			),
		).toEqual([]);
		expect(
			strictTypeErrors(
				`import { ContainerBuilder } from "../src";\n${declarations}\n${referenceExample}`,
				"skill-registration-pattern",
			),
		).toEqual([]);
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

describe("accepted ADR contracts", () => {
	it("keeps the unified API decision executable", () => {
		const adr = readFileSync(
			join(repositoryRoot, "docs", "adr", "003-unified-container-api.md"),
			"utf8",
		);
		const example = codeBlockAfter(adr, "## Decision");
		const source = `
import { ContainerBuilder, interfaceToken } from "../src";

interface IDatabase {}
interface ICache {}
class Logger {}
class ConsoleLogger extends Logger {}
class PostgreSQLDatabase implements IDatabase {
    constructor(readonly logger: Logger) {}
}
class RedisCache implements ICache {
    constructor(readonly logger: Logger) {}
}
class UserService {
    constructor(
        readonly database: IDatabase,
        readonly logger: Logger,
    ) {}
}
declare function createConfiguration(logger: Logger): { logger: Logger };

${example}
`;

		expect(strictTypeErrors(source, "adr-003-unified-api")).toEqual([]);
		expect(adr).toContain("ADR-001");
		expect(adr).toContain("ADR-008");
		expect(adr).toContain("ADR-009");
		expect(adr).toContain("`build()` does not call `validate()`");
	});

	it("documents the current scope replication contract", () => {
		const adr = normalizedMarkdown(
			readFileSync(
				join(repositoryRoot, "docs", "adr", "006-scope-creation-strategy.md"),
				"utf8",
			),
		);

		expect(adr).toContain(
			"Each scope gets a new wrapper for each registration.",
		);
		expect(adr).toContain(
			"Scoped and transient lifecycles create new lifecycle instances.",
		);
		expect(adr).toContain(
			"Singleton and borrowed singleton lifecycles stay shared.",
		);
	});

	it("documents unregistered self-resolution as a compile-time error", () => {
		const adr = normalizedMarkdown(
			readFileSync(
				join(repositoryRoot, "docs", "adr", "008-self-registration-pattern.md"),
				"utf8",
			),
		);

		expect(adr).toContain(
			"TypeScript rejects an unregistered provider dependency during registration.",
		);
		expect(adr).not.toContain("would lead to a resolution error");
	});

	it("states concurrency limits without unsupported adoption claims", () => {
		const adr = normalizedMarkdown(
			readFileSync(
				join(
					repositoryRoot,
					"docs",
					"adr",
					"010-concurrency-responsibility.md",
				),
				"utf8",
			),
		);

		expect(adr).toContain(
			"Kizuna does not serialize concurrent application work.",
		);
		expect(adr).toContain(
			"Create one root container in each worker or isolate.",
		);
		expect(adr).not.toContain("99%");
		expect(adr).not.toContain("ASP.NET Core");
		expect(adr).not.toContain("Spring Framework");
	});
});

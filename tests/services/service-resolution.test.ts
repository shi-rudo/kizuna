import { describe, expect, it } from "vitest";
import { ContainerBuilder } from "../../src/api/container-builder";
import {
    type TestInterface,
    TestStub,
    TestStubWithInterfaceDependency,
    TestStubWithOneDependency,
    TestStubWithTwoDependencies,
} from "../data/test-dummies";

describe("Register services, then resolve them to get instances", () => {
    it("should resolve service with no dependencies", () => {
        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) => r.fromType(TestStub));
        const provider = containerBuilder.build();

        const result = provider.get(TestStub).doSomething();
        expect(result).to.equal(new TestStub().doSomething());
    });

    it("should resolve service with one dependency", () => {
        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) => r.fromType(TestStub));
        containerBuilder.addSingleton((r) =>
            r.fromType(TestStubWithOneDependency).withDependencies(TestStub),
        );
        const provider = containerBuilder.build();

        const result = provider.get(TestStubWithOneDependency).doSomething();
        expect(result).to.equal(
            new TestStubWithOneDependency(new TestStub()).doSomething(),
        );
    });

    it("should resolve service with two dependencies", () => {
        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) => r.fromType(TestStub));
        containerBuilder.addSingleton((r) =>
            r.fromType(TestStubWithOneDependency).withDependencies(TestStub),
        );
        containerBuilder.addSingleton((r) =>
            r
                .fromType(TestStubWithTwoDependencies)
                .withDependencies(TestStub, TestStubWithOneDependency),
        );
        const provider = containerBuilder.build();

        const result = provider.get(TestStubWithTwoDependencies).doSomething();
        expect(result).to.equal(
            new TestStubWithTwoDependencies(
                new TestStub(),
                new TestStubWithOneDependency(new TestStub()),
            ).doSomething(),
        );
    });

    it("should resolve service using interface name", () => {
        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) =>
            r.fromName("TestInterface").useType(TestStub),
        );
        const provider = containerBuilder.build();

        const result = provider.get<TestInterface>("TestInterface").doSomething();
        expect(result).to.equal(new TestStub().doSomething());
    });

    it("should resolve service using interface with multiple dependencies", () => {
        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) => r.fromType(TestStub));
        containerBuilder.addSingleton((r) =>
            r.fromType(TestStubWithOneDependency).withDependencies(TestStub),
        );
        containerBuilder.addSingleton((r) =>
            r
                .fromName("TestInterface")
                .useType(TestStubWithTwoDependencies)
                .withDependencies(TestStub, TestStubWithOneDependency),
        );
        const provider = containerBuilder.build();

        const result = provider.get<TestInterface>("TestInterface").doSomething();
        expect(result).to.equal(
            new TestStubWithTwoDependencies(
                new TestStub(),
                new TestStubWithOneDependency(new TestStub()),
            ).doSomething(),
        );
    });

    it("should resolve service with interface dependency injection", () => {
        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) =>
            r.fromName("TestInterface").useType(TestStub),
        );
        containerBuilder.addSingleton((r) =>
            r
                .fromType(TestStubWithInterfaceDependency)
                .withDependencies("TestInterface"),
        );
        const provider = containerBuilder.build();

        const result = provider.get(TestStubWithInterfaceDependency).doSomething();
        expect(result).to.equal(
            new TestStubWithInterfaceDependency(new TestStub()).doSomething(),
        );
    });

    it("should resolve service using factory function", () => {
        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) =>
            r.fromName("TestInterface").useFactory(() => new TestStub()),
        );
        const provider = containerBuilder.build();

        const result = provider.get<TestInterface>("TestInterface").doSomething();
        expect(result).to.equal(new TestStub().doSomething());
    });

    it("should resolve service using factory with service provider", () => {
        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) => r.fromType(TestStub));
        containerBuilder.addSingleton((r) =>
            r.fromName("TestInterface").useFactory((s) => s.get(TestStub)),
        );
        const provider = containerBuilder.build();

        const result = provider.get<TestInterface>("TestInterface").doSomething();
        expect(result).to.equal(new TestStub().doSomething());
    });

    it("should register and resolve function as service", () => {
        const loggerFunction = (message: string) => `LOG: ${message}`;

        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) =>
            r.fromName("Logger").useFactory(() => loggerFunction),
        );
        const provider = containerBuilder.build();

        const result = provider.get<(message: string) => string>("Logger");
        expect(result("test")).to.equal("LOG: test");
        expect(typeof result).to.equal("function");
    });

    it("should register and resolve async services", async () => {
        // Define async services
        class AsyncDatabaseService {
            async connect() {
                // Simulate async connection
                await new Promise(resolve => setTimeout(resolve, 10));
                return "Connected to async database";
            }

            async query(sql: string) {
                await this.connect();
                return `Executed async query: ${sql}`;
            }
        }

        class AsyncUserService {
            constructor(private db: AsyncDatabaseService) {}

            async getUser(id: string) {
                const result = await this.db.query(`SELECT * FROM users WHERE id = ${id}`);
                return { id, name: "Async User", queryResult: result };
            }
        }

        // Register async services
        const containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton((r) => r.fromType(AsyncDatabaseService));
        containerBuilder.addScoped((r) =>
            r.fromType(AsyncUserService).withDependencies(AsyncDatabaseService),
        );

        const provider = containerBuilder.build();

        // Resolve and use async services
        const userService = provider.get(AsyncUserService);
        const user = await userService.getUser("123");

        expect(user.id).to.equal("123");
        expect(user.name).to.equal("Async User");
        expect(user.queryResult).to.equal("Executed async query: SELECT * FROM users WHERE id = 123");
    });

    it("should register async service with factory function", async () => {
        // Async service created via factory
        class AsyncEmailService {
            constructor(private apiKey: string) {}

            async sendEmail(to: string, subject: string) {
                await new Promise(resolve => setTimeout(resolve, 5));
                return `Email sent to ${to} with subject "${subject}" using API key: ${this.apiKey}`;
            }
        }

        const containerBuilder = new ContainerBuilder();
        
        // Register async service using factory
        containerBuilder.addTransient((r) =>
            r.fromName("EmailService").useFactory(async () => {
                // Simulate async factory initialization
                await new Promise(resolve => setTimeout(resolve, 5));
                return new AsyncEmailService("test-api-key-123");
            }),
        );

        const provider = containerBuilder.build();

        // Resolve and use async service
        const emailService = await provider.get<AsyncEmailService>("EmailService");
        const result = await emailService.sendEmail("test@example.com", "Hello World");

        expect(result).to.equal('Email sent to test@example.com with subject "Hello World" using API key: test-api-key-123');
    });

    it("should register service that requires async initialization but performs sync operations", async () => {
        // Service that needs async setup but then works synchronously
        class ConfigService {
            private config: Record<string, string> = {};

            constructor(configData: Record<string, string>) {
                this.config = configData;
            }

            // Synchronous operations after async initialization
            get(key: string): string {
                return this.config[key] || '';
            }

            getAll(): Record<string, string> {
                return { ...this.config };
            }
        }

        class DatabaseService {
            constructor(private config: ConfigService) {}

            // Synchronous operations using the async-initialized config
            getConnectionString(): string {
                return this.config.get('dbUrl') || 'localhost:5432';
            }

            connect(): string {
                const connStr = this.getConnectionString();
                return `Connected to ${connStr}`;
            }
        }

        const containerBuilder = new ContainerBuilder();

        // Register ConfigService with async factory (simulating loading config from file/network)
        containerBuilder.addSingleton((r) =>
            r.fromName("ConfigService").useFactory(async (provider) => {
                // Simulate async config loading (from file, API, etc.)
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Load configuration asynchronously
                const configData = {
                    dbUrl: "postgresql://localhost:5432/myapp",
                    apiKey: "secret-api-key",
                    environment: "test"
                };
                
                return new ConfigService(configData);
            })
        );

        const provider = containerBuilder.build();

        // First resolve ConfigService asynchronously (due to async factory)
        const config = await provider.get<ConfigService>("ConfigService");
        
        // Now register DatabaseService after ConfigService is initialized
        const builder2 = new ContainerBuilder();
        builder2.addSingleton((r) =>
            r.fromName("ConfigService").useFactory(() => config)
        );
        builder2.addSingleton((r) =>
            r.fromType(DatabaseService).withDependencies("ConfigService")
        );

        const provider2 = builder2.build();
        const dbService = provider2.get(DatabaseService);

        // All operations are now synchronous
        expect(config.get("dbUrl")).to.equal("postgresql://localhost:5432/myapp");
        expect(config.get("apiKey")).to.equal("secret-api-key");
        expect(dbService.getConnectionString()).to.equal("postgresql://localhost:5432/myapp");
        expect(dbService.connect()).to.equal("Connected to postgresql://localhost:5432/myapp");
    });

    it("should register service that requires async initialization and performs async operations", async () => {
        // Service that needs async setup AND performs async operations
        class AsyncDatabaseConfig {
            private config: Record<string, string> = {};
            private isConnected: boolean = false;

            constructor(configData: Record<string, string>) {
                this.config = configData;
            }

            // Async operations after async initialization
            async connect(): Promise<string> {
                if (!this.isConnected) {
                    // Simulate async connection process
                    await new Promise(resolve => setTimeout(resolve, 15));
                    this.isConnected = true;
                }
                return `Async connected to ${this.config.dbUrl}`;
            }

            async query(sql: string): Promise<string> {
                await this.connect(); // Ensure connection
                await new Promise(resolve => setTimeout(resolve, 5));
                return `Async executed: ${sql} on ${this.config.dbUrl}`;
            }

            // Sync getter for immediate access
            getConnectionString(): string {
                return this.config.dbUrl || 'localhost:5432';
            }
        }

        class AsyncUserRepository {
            constructor(private dbConfig: AsyncDatabaseConfig) {}

            async findUser(id: string): Promise<{ id: string; name: string; source: string }> {
                // Both the dependency and this service perform async operations
                const queryResult = await this.dbConfig.query(`SELECT * FROM users WHERE id = ${id}`);
                await new Promise(resolve => setTimeout(resolve, 5)); // Simulate processing
                
                return {
                    id,
                    name: "Async User",
                    source: queryResult
                };
            }

            async saveUser(user: { id: string; name: string }): Promise<string> {
                const connectionInfo = await this.dbConfig.connect();
                const saveResult = await this.dbConfig.query(`INSERT INTO users VALUES ('${user.id}', '${user.name}')`);
                return `Saved user via ${connectionInfo}: ${saveResult}`;
            }
        }

        const containerBuilder = new ContainerBuilder();

        // Register AsyncDatabaseConfig with async factory (loading config from network/file)
        containerBuilder.addSingleton((r) =>
            r.fromName("AsyncDatabaseConfig").useFactory(async () => {
                // Simulate async config loading (from remote API, file system, etc.)
                await new Promise(resolve => setTimeout(resolve, 20));
                
                // Load configuration asynchronously
                const configData = {
                    dbUrl: "postgresql://remote.server:5432/asyncapp",
                    poolSize: "10",
                    timeout: "30000"
                };
                
                return new AsyncDatabaseConfig(configData);
            })
        );

        const provider = containerBuilder.build();

        // First resolve AsyncDatabaseConfig asynchronously
        const dbConfig = await provider.get<AsyncDatabaseConfig>("AsyncDatabaseConfig");
        
        // Create a second container with the initialized config and the repository
        const builder2 = new ContainerBuilder();
        builder2.addSingleton((r) =>
            r.fromName("AsyncDatabaseConfig").useFactory(() => dbConfig)
        );
        builder2.addScoped((r) =>
            r.fromType(AsyncUserRepository).withDependencies("AsyncDatabaseConfig")
        );

        const provider2 = builder2.build();
        const userRepo = provider2.get(AsyncUserRepository);

        // Now perform async operations with the async-initialized, async-operating service
        const user = await userRepo.findUser("456");
        const saveResult = await userRepo.saveUser({ id: "789", name: "New User" });

        // Verify the async initialization worked
        expect(dbConfig.getConnectionString()).to.equal("postgresql://remote.server:5432/asyncapp");
        
        // Verify the async operations worked
        expect(user.id).to.equal("456");
        expect(user.name).to.equal("Async User");
        expect(user.source).to.equal("Async executed: SELECT * FROM users WHERE id = 456 on postgresql://remote.server:5432/asyncapp");
        
        expect(saveResult).to.include("Saved user via Async connected to postgresql://remote.server:5432/asyncapp");
        expect(saveResult).to.include("INSERT INTO users VALUES ('789', 'New User')");
    });
});

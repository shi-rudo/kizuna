# Kizuna 絆

A lightweight, type-safe dependency injection container for TypeScript and JavaScript applications. Kizuna provides clean, intuitive APIs for managing service lifecycles with support for singleton, scoped, and transient patterns.

## Introduction

Kizuna (F, meaning "bond" or "connection" in Japanese) is designed to create strong connections between your application's services through dependency injection. It offers:

- **Type Safety**: Full TypeScript support with strong typing
- **Multiple Lifecycles**: Singleton, Scoped, and Transient service management
- **Flexible Configuration**: Configure services by type or interface name
- **Factory Support**: Custom factory functions for complex service creation
- **Environment Agnostic**: Works in Node.js, browsers, and other JavaScript environments
- **Zero Dependencies**: Lightweight with no external dependencies

## Runtime Supports

Kizuna is designed to work across different JavaScript environments:

- **Node.js**: Version 18.0.0 and above
- **Browsers**: Modern browsers supporting ES2020+
- **Edge Environments**: Cloudflare Workers, Vercel Edge Functions, etc.
- **Other Runtimes**: Deno, Bun, and other JavaScript runtimes

## Browser Supports

- **Chrome**: 85+
- **Firefox**: 80+
- **Safari**: 14+
- **Edge**: 85+

## Installation

```bash
# npm
npm install kizuna

# yarn
yarn add kizuna

# pnpm
pnpm add kizuna
```

<<<<<<< HEAD
## Example

### Synchronous Services

Simple example with synchronous services:
=======
## API Overview

Kizuna provides two APIs for different use cases:

### 🎯 **Type-Safe API (Recommended)**

The new type-safe API provides perfect IDE autocompletion, type inference, and compile-time safety:
>>>>>>> 90d0f39 (Initial commit with type safety changes)

```typescript
import { ContainerBuilder } from "kizuna";

<<<<<<< HEAD
// Define your services
class ConfigService {
  getDbUrl() {
    return "postgresql://localhost:5432/myapp";
  }
=======
class ConfigService {
  getDbUrl() { return "postgresql://localhost:5432/myapp"; }
>>>>>>> 90d0f39 (Initial commit with type safety changes)
}

class DatabaseService {
  constructor(private config: ConfigService) {}
<<<<<<< HEAD

  connect() {
    const url = this.config.getDbUrl();
    return `Connected to database at ${url}`;
  }
=======
  connect() { return `Connected to ${this.config.getDbUrl()}`; }
>>>>>>> 90d0f39 (Initial commit with type safety changes)
}

class UserService {
  constructor(private db: DatabaseService) {}
<<<<<<< HEAD

=======
>>>>>>> 90d0f39 (Initial commit with type safety changes)
  getUser(id: string) {
    this.db.connect();
    return { id, name: "John Doe", email: "john@example.com" };
  }
}

<<<<<<< HEAD
// Build your container
const builder = new ContainerBuilder();

// Configure services
builder.addSingleton((r) => r.fromType(ConfigService));
builder.addSingleton((r) =>
  r.fromType(DatabaseService).withDependencies(ConfigService)
);
builder.addScoped((r) =>
  r.fromType(UserService).withDependencies(DatabaseService)
);
=======
// ✨ Type-safe registration with perfect autocompletion
const container = new ContainerBuilder()
  .registerSingleton('Config', ConfigService)           // Type inferred: ConfigService
  .registerSingleton('Database', DatabaseService, 'Config')  // Dependencies as strings  
  .registerScoped('UserService', UserService, 'Database')    // Chained with type safety
  .buildTypeSafe();

// 🔥 IDE autocompletion suggests: 'Config', 'Database', 'UserService'
const userService = container.get('UserService');  // Type: UserService (auto-inferred!)
const user = userService.getUser("123");           // Full IntelliSense support
```

### ⚡ **Classic API (Backward Compatible)**

The original callback-based API for maximum flexibility:

```typescript
// Configure services with callback API
const builder = new ContainerBuilder();
builder.addSingleton((r) => r.fromType(ConfigService));
builder.addSingleton((r) => r.fromType(DatabaseService).withDependencies(ConfigService));
builder.addScoped((r) => r.fromType(UserService).withDependencies(DatabaseService));
>>>>>>> 90d0f39 (Initial commit with type safety changes)

// Build and use
const container = builder.build();
const userService = container.get(UserService);
const user = userService.getUser("123");
<<<<<<< HEAD
console.log(user); // { id: "123", name: "John Doe", email: "john@example.com" }
=======
```

## 🆚 **API Comparison**

| Feature | Type-Safe API | Classic API |
|---------|---------------|-------------|
| **Methods** | `registerSingleton()`, `registerScoped()`, `registerTransient()` | `addSingleton()`, `addScoped()`, `addTransient()` |
| **Registration** | Direct constructor: `registerSingleton('key', ServiceClass, ...deps)` | Callback: `addSingleton(r => r.fromType(ServiceClass).withDeps(...))` |
| **Build Method** | `buildTypeSafe()` → `TypeSafeServiceLocator` | `build()` → `ServiceLocator` |
| **Type Safety** | ✅ Perfect type inference & autocompletion | ❌ Requires manual type annotations |
| **IDE Support** | ✅ String key autocompletion | ❌ No autocompletion for string keys |
| **Compile-Time Safety** | ✅ Errors for unregistered services | ❌ Runtime-only validation |
| **Service Resolution** | `get('ServiceKey')` → fully typed | `get<Type>('ServiceKey')` → requires generics |
| **Flexibility** | 🔶 Constructor-focused | ✅ Full factory/type/instance options |
| **When to Use** | New projects, maximum type safety | Legacy code, complex registrations |

### 💡 **Which API Should I Use?**

- **Choose Type-Safe API** if you want:
  - Maximum developer productivity with IDE autocompletion
  - Compile-time safety and error prevention
  - Modern TypeScript development experience
  - Simple service registrations with constructors

- **Choose Classic API** if you need:
  - Complex factory functions with custom logic
  - Interface-based registrations (`fromName()`)
  - Maximum flexibility in service configuration
  - Backward compatibility with existing code

### 🚀 **Type-Safe API Advanced Usage**

The type-safe API supports scoped services and demonstrates perfect type inference across scopes:

```typescript
// Advanced type-safe registration
const container = new ContainerBuilder()
  .registerSingleton('Logger', ConsoleLogger)
  .registerSingleton('Database', DatabaseConnection, 'Logger')
  .registerScoped('UserRepo', UserRepository, 'Database', 'Logger')
  .registerScoped('OrderRepo', OrderRepository, 'Database')
  .registerTransient('EmailService', EmailService, 'Logger')
  .buildTypeSafe();

// 🎯 Perfect type inference in scoped scenarios
const scope1 = container.startScope();
const scope2 = container.startScope();

const userRepo1 = scope1.get('UserRepo');  // Type: UserRepository
const userRepo2 = scope2.get('UserRepo');  // Type: UserRepository  
console.log(userRepo1 !== userRepo2);      // true (different scoped instances)

const logger1 = scope1.get('Logger');      // Type: ConsoleLogger
const logger2 = scope2.get('Logger');      // Type: ConsoleLogger
console.log(logger1 === logger2);          // true (same singleton instance)

// 🔥 Compile-time error prevention
// const invalid = container.get('NonExistent');  // ❌ TypeScript Error!
>>>>>>> 90d0f39 (Initial commit with type safety changes)
```

### Asynchronous Services

Kizuna supports two async patterns: services that perform async operations and services that require async initialization.

#### Async Operations Pattern

For services that perform async operations after being resolved:

```typescript
import { ContainerBuilder } from "kizuna";

// Services with async operations
class DatabaseConnection {
  constructor(private connectionString: string) {}

  async connect() {
    // Simulate async connection
    await new Promise((resolve) => setTimeout(resolve, 100));
    return `Connected to ${this.connectionString}`;
  }

  async query(sql: string) {
    await this.connect();
    return `Executed: ${sql}`;
  }
}

class UserRepository {
  constructor(private db: DatabaseConnection) {}

  async findById(id: string) {
    const result = await this.db.query(`SELECT * FROM users WHERE id = ${id}`);
    return { id, name: "Jane Doe", result };
  }
}

// Configure services normally - container resolution is sync, operations are async
const builder = new ContainerBuilder();
builder.addSingleton((r) => r.fromType(DatabaseConnection));
builder.addScoped((r) =>
  r.fromType(UserRepository).withDependencies(DatabaseConnection)
);

const container = builder.build();
const userRepo = container.get(UserRepository); // Sync resolution
const user = await userRepo.findById("123"); // Async operation
```

#### Async Initialization Pattern

For services that require async initialization (loading config, establishing connections, etc.):

```typescript
// Service that needs async initialization
class ConfigService {
  private config: Record<string, string> = {};

  constructor(configData: Record<string, string>) {
    this.config = configData;
  }

  get(key: string): string {
    return this.config[key] || "";
  }
}

class DatabaseService {
  constructor(private config: ConfigService) {}

  // Can perform either sync or async operations after initialization
  async query(sql: string): Promise<string> {
    const dbUrl = this.config.get("dbUrl");
    await new Promise((resolve) => setTimeout(resolve, 10));
    return `Executed "${sql}" on ${dbUrl}`;
  }
}

// Configure with async factory for initialization
const builder = new ContainerBuilder();

// Async initialization - load config from file/API/network
builder.addSingleton((r) =>
  r.fromName("ConfigService").useFactory(async () => {
    // Simulate loading config from external source
    await new Promise((resolve) => setTimeout(resolve, 100));

    const configData = {
      dbUrl: "postgresql://localhost:5432/myapp",
      apiKey: "secret-key",
    };

    return new ConfigService(configData);
  })
);

// Usage requires async resolution for services with async initialization
async function main() {
  const container = builder.build();

  // First resolve async-initialized services
  const config = await container.get<ConfigService>("ConfigService");

  // Then create dependent services
  const builder2 = new ContainerBuilder();
  builder2.addSingleton((r) =>
    r.fromName("ConfigService").useFactory(() => config)
  );
  builder2.addScoped((r) =>
    r.fromType(DatabaseService).withDependencies("ConfigService")
  );

  const container2 = builder2.build();
  const dbService = container2.get(DatabaseService);

  // Now use the service (sync or async operations)
  const result = await dbService.query("SELECT * FROM users");
  console.log(result);

  container2.dispose();
}

main();
```

#### Combined Pattern: Async Initialization + Async Operations

```typescript
class AsyncDatabaseConfig {
  private config: Record<string, string>;
  private isConnected = false;

  constructor(configData: Record<string, string>) {
    this.config = configData;
  }

  async connect(): Promise<string> {
    if (!this.isConnected) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.isConnected = true;
    }
    return `Connected to ${this.config.dbUrl}`;
  }

  async query(sql: string): Promise<string> {
    await this.connect();
    return `Executed: ${sql}`;
  }
}

// Configure with async initialization
builder.addSingleton((r) =>
  r.fromName("AsyncDatabaseConfig").useFactory(async () => {
    // Load config asynchronously
    await new Promise((resolve) => setTimeout(resolve, 100));
    return new AsyncDatabaseConfig({
      dbUrl: "postgresql://remote:5432/app",
    });
  })
);

// Usage: async initialization + async operations
const container = builder.build();
const dbConfig = await container.get<AsyncDatabaseConfig>(
  "AsyncDatabaseConfig"
);
const result = await dbConfig.query("SELECT * FROM users");
```

## Injecting Dependencies

Kizuna supports multiple ways to configure and inject dependencies:

### Constructor Dependencies

```typescript
class EmailService {
  constructor(private config: ConfigService, private logger: LoggerService) {}
}

// Configure with dependencies
builder.addTransient((r) =>
  r.fromType(EmailService).withDependencies(ConfigService, LoggerService)
);
```

### Interface-based Configuration

```typescript
interface IRepository {
  save(data: any): void;
}

class DatabaseRepository implements IRepository {
  save(data: any) {
    // Implementation
  }
}

// Configure by interface name
builder.addScoped((r) => r.fromName("IRepository").useType(DatabaseRepository));

// Resolve by interface
const repo = container.get<IRepository>("IRepository");
```

### Service Factory

Service factories provide complete control over service instantiation:

```typescript
// Simple factory
builder.addSingleton((r) =>
  r.fromName("ApiClient").useFactory(() => new ApiClient(process.env.API_URL))
);

// Factory with dependencies
builder.addScoped((r) =>
  r.fromName("UserService").useFactory((provider) => {
    const db = provider.get(DatabaseService);
    const logger = provider.get<ILogger>("Logger");
    return new UserService(db, logger);
  })
);

// Conditional factory
builder.addTransient((r) =>
  r.fromName("Storage").useFactory((provider) => {
    const config = provider.get(ConfigService);
    return config.isDevelopment
      ? new InMemoryStorage()
      : new RedisStorage(config.redisUrl);
  })
);
```

### Service Provider

The service provider is your runtime container for resolving services:

```typescript
const container = builder.build();

// Resolve by type
const userService = container.get(UserService);

// Resolve by string key
const apiClient = container.get<IApiClient>("ApiClient");

// Create scopes for isolation
const requestScope = container.startScope();
const scopedService = requestScope.get(RequestService);

// Clean up when done
requestScope.dispose();
```

## Service Configuration Methods

Kizuna provides different methods for configuring services depending on your use case. Understanding when to use each method is key to effective dependency injection.

### `fromType()` - Constructor-based Services

Use `fromType()` when you want to register a concrete class by its constructor.

**When to use:**

- You have a concrete class with a constructor
- You want type safety and IntelliSense support
- Dependencies are injected via constructor parameters
- Most common and recommended approach

**Syntax:** `r.fromType(ConstructorFunction)`

```typescript
class DatabaseService {
  constructor(private config: ConfigService) {}
  connect() {
    /* implementation */
  }
}

class UserService {
  constructor(private db: DatabaseService, private logger: LoggerService) {}
  getUser(id: string) {
    /* implementation */
  }
}

// Configure concrete classes
builder.addSingleton((r) => r.fromType(ConfigService));
builder.addSingleton((r) =>
  r.fromType(DatabaseService).withDependencies(ConfigService)
);
builder.addScoped((r) =>
  r.fromType(UserService).withDependencies(DatabaseService, LoggerService)
);

// Resolve by constructor
const userService = container.get(UserService);
```

### `fromName()` - String-based Services

Use `fromName()` when you need to register services by string identifiers.

**When to use:**

- Implementing interfaces or abstract types
- Multiple implementations of the same interface
- Cross-module dependencies where you don't want to import types
- Dynamic service registration
- When you need to avoid circular import dependencies

**Syntax:** `r.fromName('ServiceName')`

```typescript
interface ILogger {
  log(message: string): void;
}

interface IRepository<T> {
  findById(id: string): T;
  save(item: T): void;
}

class ConsoleLogger implements ILogger {
  log(message: string) {
    console.log(message);
  }
}

class FileLogger implements ILogger {
  log(message: string) {
    /* write to file */
  }
}

class UserRepository implements IRepository<User> {
  findById(id: string): User {
    /* implementation */
  }
  save(user: User): void {
    /* implementation */
  }
}

// Configure by interface name
builder.addSingleton((r) => r.fromName("ILogger").useType(ConsoleLogger));
builder.addScoped((r) => r.fromName("IUserRepository").useType(UserRepository));

// Multiple implementations
builder.addSingleton((r) => r.fromName("ConsoleLogger").useType(ConsoleLogger));
builder.addSingleton((r) => r.fromName("FileLogger").useType(FileLogger));

// Resolve by string key
const logger = container.get<ILogger>("ILogger");
const userRepo = container.get<IRepository<User>>("IUserRepository");
```

### `useType()` vs `useFactory()` - Implementation Methods

After using `fromName()`, you choose how to create the service:

#### `useType()` - Constructor Instantiation

Use when you want the container to call the constructor directly.

```typescript
// Simple instantiation - no dependencies
builder.addSingleton((r) => r.fromName("Logger").useType(ConsoleLogger));

// With dependencies
builder.addScoped((r) =>
  r
    .fromName("IUserService")
    .useType(UserService)
    .withDependencies(DatabaseService, "Logger")
);
```

#### `useFactory()` - Custom Factory Function

Use when you need custom logic for creating the service.

**When to use `useFactory()`:**

- Complex initialization logic
- Conditional service creation
- Async initialization (loading config, establishing connections)
- Services that require specific constructor parameters
- Integration with external libraries
- Environment-specific implementations

```typescript
// Simple factory
builder.addSingleton((r) =>
  r
    .fromName("ApiClient")
    .useFactory(() => new ApiClient(process.env.API_URL, { timeout: 5000 }))
);

// Factory with dependencies
builder.addScoped((r) =>
  r.fromName("UserService").useFactory((provider) => {
    const db = provider.get(DatabaseService);
    const logger = provider.get<ILogger>("Logger");
    const config = provider.get(ConfigService);

    return new UserService(db, logger, config.getUserServiceOptions());
  })
);

// Conditional factory
builder.addTransient((r) =>
  r.fromName("Storage").useFactory((provider) => {
    const config = provider.get(ConfigService);

    if (config.isDevelopment) {
      return new InMemoryStorage();
    } else if (config.useRedis) {
      return new RedisStorage(config.redisUrl);
    } else {
      return new FileStorage(config.storagePath);
    }
  })
);

// Async initialization factory
builder.addSingleton((r) =>
  r.fromName("DatabaseConnection").useFactory(async (provider) => {
    const config = provider.get(ConfigService);
    const connection = new DatabaseConnection(config.connectionString);
    await connection.connect();
    return connection;
  })
);
```

### Decision Tree: Which Method to Use?

```
Do you have a concrete class?
├─ YES: Use fromType(ClassName)
│   └─ Need dependencies? Add .withDependencies(...)
│
└─ NO: Use fromName('ServiceName')
    ├─ Simple constructor? Use .useType(ClassName)
    │   └─ Need dependencies? Add .withDependencies(...)
    │
    └─ Complex creation logic? Use .useFactory(...)
        ├─ Need dependencies? Access via provider parameter
        └─ Async initialization? Return Promise from factory
```

### Best Practices

1. **Prefer `fromType()` for concrete classes** - Better type safety and IntelliSense
2. **Use `fromName()` for interfaces and abstractions** - Enables polymorphism
3. **Use `useFactory()` for complex initialization** - When constructor isn't enough
4. **Keep factory functions pure** - Avoid side effects in factories
5. **Use consistent naming** - Prefix interfaces with 'I' (e.g., 'ILogger', 'IRepository')

### Common Patterns

#### Repository Pattern

```typescript
// Interface-based registration
builder.addScoped((r) =>
  r.fromName("IUserRepository").useType(DatabaseUserRepository)
);
builder.addScoped((r) =>
  r.fromName("IOrderRepository").useType(DatabaseOrderRepository)
);

// Service depends on interfaces
builder.addScoped((r) =>
  r
    .fromType(OrderService)
    .withDependencies("IUserRepository", "IOrderRepository")
);
```

#### Environment-specific Services

```typescript
builder.addSingleton((r) =>
  r.fromName("IEmailService").useFactory((provider) => {
    const config = provider.get(ConfigService);
    return config.isDevelopment
      ? new MockEmailService()
      : new SmtpEmailService(config.smtpSettings);
  })
);
```

#### Plugin Architecture

```typescript
// Register multiple implementations
builder.addTransient((r) => r.fromName("JsonParser").useType(JsonParser));
builder.addTransient((r) => r.fromName("XmlParser").useType(XmlParser));
builder.addTransient((r) => r.fromName("CsvParser").useType(CsvParser));

// Factory that chooses implementation
builder.addTransient((r) =>
  r.fromName("IParser").useFactory((provider) => {
    const fileType = getCurrentFileType(); // Your logic
    return provider.get<IParser>(`${fileType}Parser`);
  })
);
```

## API

### ContainerBuilder

The main class for configuring your dependency injection container.

#### `addSingleton<T>(registration: ServiceBuilderCallback<T>): ContainerBuilder`

Registers a service with singleton lifetime (one instance per application).

**Parameters:**

| Param            | Type                        | Details                                    |
| :--------------- | :-------------------------- | :----------------------------------------- |
| **registration** | `ServiceBuilderCallback<T>` | Factory function for service configuration |

**Example:**

```typescript
builder.addSingleton((r) => r.fromType(ConfigService));
```

#### `addScoped<T>(registration: ServiceBuilderCallback<T>): ContainerBuilder`

Registers a service with scoped lifetime (one instance per scope).

**Parameters:**

| Param            | Type                        | Details                                    |
| :--------------- | :-------------------------- | :----------------------------------------- |
| **registration** | `ServiceBuilderCallback<T>` | Factory function for service configuration |

**Example:**

```typescript
builder.addScoped((r) =>
  r.fromType(UserService).withDependencies(DatabaseService)
);
```

#### `addTransient<T>(registration: ServiceBuilderCallback<T>): ContainerBuilder`

Registers a service with transient lifetime (new instance every time).

**Parameters:**

| Param            | Type                        | Details                                    |
| :--------------- | :-------------------------- | :----------------------------------------- |
| **registration** | `ServiceBuilderCallback<T>` | Factory function for service configuration |

**Example:**

```typescript
builder.addTransient((r) => r.fromType(Logger));
```

#### `build(): ServiceLocator`

Builds the configured container and returns a ServiceLocator.

**Returns:** `ServiceLocator` - The built container ready for service resolution

#### `isRegistered<T>(serviceName: string | T): boolean`

Checks if a service is registered in the container.

**Parameters:**

| Param           | Type          | Details                              |
| :-------------- | :------------ | :----------------------------------- |
| **serviceName** | `string \| T` | Service name or constructor to check |

#### `validate(): string[]`

Validates all configured services and returns any issues found.

**Returns:** `string[]` - Array of validation warnings/errors

### ServiceLocator

Interface for service resolution and container management.

#### `get<T>(key: ServiceKey<T>): T`

Resolves and returns an instance of the requested service.

**Parameters:**

| Param   | Type            | Details                                        |
| :------ | :-------------- | :--------------------------------------------- |
| **key** | `ServiceKey<T>` | Service key (string or constructor) to resolve |

**Returns:** `T` - An instance of the requested service

#### `startScope(): ServiceLocator`

Creates a new scope for isolated service resolution.

**Returns:** `ServiceLocator` - A new scoped container

#### `dispose(): void`

Disposes all services and cleans up resources.

### Service Lifecycles

#### Singleton

- **Lifetime**: Application lifetime
- **Use Case**: Expensive-to-create services, shared state, configuration
- **Example**: Database connections, configuration services, caches

#### Scoped

- **Lifetime**: Per scope (e.g., per request)
- **Use Case**: Request-specific services, transaction contexts
- **Example**: User context, request processors, database transactions

#### Transient

- **Lifetime**: New instance every time
- **Use Case**: Lightweight services, stateless operations
- **Example**: Loggers, utility services, data processors

## TypeScript

Kizuna is built with TypeScript and provides full type safety out of the box. A TypeScript declaration file is bundled with this package.

### Configuration

To get TypeScript to resolve types automatically, ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

### Type Safety Examples

```typescript
// Type-safe service configuration
interface IUserRepository {
  findById(id: string): User;
}

class UserRepository implements IUserRepository {
  findById(id: string): User {
    // Implementation
  }
}

// Strongly typed configuration
builder.addScoped((r) => r.fromName("IUserRepository").useType(UserRepository));

// Type-safe resolution
const userRepo = container.get<IUserRepository>("IUserRepository");
// userRepo is now strongly typed as IUserRepository
```

### Generic Factory Functions

```typescript
// Generic factory with type inference
function createFactory<T>(factory: () => T): Factory<T> {
  return () => factory();
}

const configFactory = createFactory(() => new AppConfig());
builder.addSingleton((r) => r.fromName("Config").useFactory(configFactory));
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

This project was inspired by the foundational work of Remi Henache on the [injected-ts](https://github.com/remihenache/injected-ts) library.

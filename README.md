# Kizuna 絆

> **Release Candidate**
> Kizuna is approaching a stable 1.0 release. The API surface is finalized and production use is encouraged. Please report any issues or feedback via GitHub.

A lightweight, type-safe dependency injection container for TypeScript and JavaScript applications. Kizuna provides a unified, intuitive API for managing service lifecycles with comprehensive type safety and IDE autocompletion.

## ✨ Features

- **🎯 Comprehensive Type Safety**: Full TypeScript support with automatic type inference
- **🚀 Unified API**: Single API supporting all registration patterns with a focus on developer experience
- **🔄 Multiple Lifecycles**: Singleton, Scoped, and Transient service management
- **🏭 Flexible Registration**: Constructor, interface, and factory-based service registration
- **🛡️ Parameter Validation**: Automatic validation of dependency names vs constructor parameters
- **📝 Enhanced IDE Support**: Full autocompletion and compile-time validation
- **⚡ Zero Dependencies**: Lightweight with no external dependencies
- **🌍 Cross-Platform**: Works in Node.js, browsers, and edge environments

## 🚀 Quick Start

```bash
npm install @shirudo/kizuna
```

TypeScript projects must use TypeScript 5.0 or newer. Kizuna declares this range as a peer dependency.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

// Define your services
class Logger {
  log(message: string) { console.log(`[LOG] ${message}`); }
}

class DatabaseService {
  constructor(private logger: Logger) {}
  connect() { this.logger.log('Connected to database'); }
}

class UserService {
  constructor(private db: DatabaseService, private logger: Logger) {}
  getUser(id: string) {
    this.db.connect();
    this.logger.log(`Getting user ${id}`);
    return { id, name: 'John Doe' };
  }
}

// 🎯 Register services with full type safety
const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)                      // Type: Logger ✨
  .registerSingleton('Database', DatabaseService, 'Logger') // Typed dependency key
  .registerScoped('UserService', UserService, 'Database', 'Logger')
  .build();

// ✅ Get services with enhanced IDE autocompletion
const userService = container.get('UserService'); // Type: UserService (auto-inferred!)
const user = userService.getUser('123');          // Full IntelliSense support
```

## 🎨 The Unified API

Kizuna provides a single, comprehensive API that combines type safety and flexibility. All registration patterns work together with full type inference.

### 🏗️ **Constructor Registration** (Most Common)

For services with constructor dependencies:

TypeScript checks each dependency key against the constructor parameter at the same position. Register each dependency before its consumer.

Each registration key must be one fixed string literal. Broad strings, unions, and open template patterns fail compilation.

A root builder starts with an empty registry. Do not supply a populated registry type to its constructor.

Kizuna checks each public constructor overload. Kizuna does not set a fixed overload count. TypeScript compiler limits still apply.

Any declared parameter tuple is valid. Different overload result types produce a union.

```typescript
const container = new ContainerBuilder()
  .registerSingleton('Config', ConfigService)
  .registerScoped('UserService', UserService, 'Config')      // 'Config' must provide the first parameter type
  .registerTransient('EmailService', EmailService, 'Config')
  .build();

// IDE suggests: 'Config', 'UserService', 'EmailService'
const userService = container.get('UserService'); // Type: UserService ✨
```

If an existing registration fails compilation, read the [typed constructor dependency migration](./docs/migrations/typed-constructor-dependencies.md).

### 🎯 **Interface Registration** (For Abstractions)

For implementing abstractions and polymorphism:

```typescript
import { ContainerBuilder, interfaceToken } from '@shirudo/kizuna';

class Logger {
  log(message: string): void { console.log(message); }
}

interface IEmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

interface ICache {
  get(key: string): unknown;
}

class SMTPEmailService implements IEmailService {
  constructor(private logger: Logger) {}

  send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`Sending email to ${to}: ${subject} (${body.length} characters)`);
    return Promise.resolve();
  }
}

class RedisCache implements ICache {
  constructor(private logger: Logger) {}

  get(key: string): unknown {
    this.logger.log(`Reading cache key: ${key}`);
    return undefined;
  }
}

const EmailService = interfaceToken<IEmailService>()('EmailService');
const Cache = interfaceToken<ICache>()('Cache');

const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerSingletonInterface(EmailService, SMTPEmailService, 'Logger')
  .registerScopedInterface(Cache, RedisCache, 'Logger')
  .build();

const emailService = container.get(EmailService); // Type: IEmailService ✨
const cache = container.get(Cache);               // Type: ICache ✨
```

### 🏭 **Factory Registration** (For Complex Creation)

For complex initialization, conditional logic, or primitive values:

```typescript
const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  
  // Factory returning objects
  .registerSingletonFactory('Config', (provider) => {
    const logger = provider.get('Logger'); // Type: Logger ✨
    logger.log('Loading configuration...');
    
    return {
      environment: process.env.NODE_ENV || 'development',
      database: { url: 'postgresql://localhost:5432/app' },
      features: { analytics: true }
    };
  })
  
  // Factory returning primitives
  .registerSingletonFactory('MaxRetries', () => 3)
  .registerSingletonFactory('SupportedLanguages', () => ['en', 'es', 'fr', 'de'])
  
  // Factory returning functions
  .registerSingletonFactory('Validator', () => ({
    email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    required: (value: any) => value != null && value !== ''
  }))
  
  .build();

const config = container.get('Config');     // Type: inferred from factory return! ✨
const maxRetries = container.get('MaxRetries'); // Type: number ✨
const validator = container.get('Validator');   // Type: validation functions object ✨
```

### 🔄 **All Lifecycles Supported**

Every registration pattern supports all three lifecycles:

```typescript
const LoggerService = interfaceToken<ILogger>()('Logger');
const Cache = interfaceToken<ICache>()('Cache');
const Validator = interfaceToken<IValidator>()('Validator');

const container = new ContainerBuilder()
  // Singleton services (shared across entire application)
  .registerSingleton('Config', ConfigService)
  .registerSingletonInterface(LoggerService, ConsoleLogger)
  .registerSingletonFactory('Database', (provider) => createConnection())
  
  // Scoped services (shared within scope, new per scope)
  .registerScoped('RequestContext', RequestContext, LoggerService)
  .registerScopedInterface(Cache, MemoryCache, LoggerService)
  .registerScopedFactory('RequestId', () => crypto.randomUUID())
  
  // Transient services (new instance every time)
  .registerTransient('EmailService', EmailService, LoggerService)
  .registerTransientInterface(Validator, DefaultValidator)
  .registerTransientFactory('Timestamp', () => Date.now())
  
  .build();
```

Create each interface token once. The token stores the interface type and one
fixed string key. Registration and resolution infer both types from the token:

```typescript
const EmailService = interfaceToken<IEmailService>()('EmailService');

const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerSingletonInterface(EmailService, SMTPEmailService, 'Logger')
  .build();

container.get(EmailService); // IEmailService
```

The two calls in `interfaceToken<IEmailService>()('EmailService')` let TypeScript
keep both the explicit interface type and the inferred literal key. Broad strings,
unions, and open template-literal patterns are not valid token keys.

For more information, read the [typed interface dependency migration](./docs/migrations/typed-interface-dependencies.md).

### 📦 **Multi-Registration** (Multiple Implementations per Key)

For registering multiple implementations under the same key — plugin systems, middleware pipelines, event handlers, and validation chains:

```typescript
// Register multiple handlers under one key
const container = new ContainerBuilder()
  .addSingleton('handlers', HandlerA)
  .addSingleton('handlers', HandlerB)
  .addSingleton('handlers', HandlerC)
  .build();

// Resolve all implementations as an array
const handlers = container.getAll('handlers'); // [HandlerA, HandlerB, HandlerC]
handlers.forEach(h => h.handle(event));
```

All lifecycles are supported — use `addSingleton`, `addScoped`, or `addTransient` for constructor-based registration, and `addSingletonFactory`, `addScopedFactory`, or `addTransientFactory` for factory-based registration:

```typescript
const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)

  // Constructor-based multi-registration with dependencies
  .addSingleton('middleware', AuthMiddleware, 'Logger')
  .addSingleton('middleware', LoggingMiddleware)

  // Factory-based multi-registration
  .addTransientFactory('validators', () => new EmailValidator())
  .addTransientFactory('validators', () => new PhoneValidator())

  .build();

const middleware = container.getAll('middleware');  // [AuthMiddleware, LoggingMiddleware]
const validators = container.getAll('validators'); // New instances each time
```

**Key rules:**
- `add*()` and `register*()` cannot be mixed for the same key — each key is either single or multi
- `getAll()` returns an array; `get()` on a multi-key also returns the array
- `getAll()` on a single-registration key wraps the result in a single-element array
- Registration order is preserved in the returned array

## 🎯 Comprehensive Type Safety

Kizuna provides compile-time type checking and IDE integration:

### ✅ **Compile-Time Validation**

```typescript
const container = new ContainerBuilder()
  .registerSingleton('UserService', UserService, 'Logger')
  .build();

// ❌ TypeScript Error: 'NonExistent' doesn't exist in registry
const invalid = container.get('NonExistent');

// Autocompletion suggests only registered services
const service = container.get(''); // IDE suggests: 'UserService'
```

### 🔍 **Runtime Validation**

```typescript
const builder = new ContainerBuilder()
  .registerSingleton('Service', SomeService, 'MissingDependency'); // Oops!

// Catch configuration errors before runtime
const issues = builder.validate();
// Returns: ["Service depends on unregistered service 'MissingDependency'"]

if (issues.length === 0) {
  const container = builder.build();
} else {
  console.error('Configuration issues:', issues);
}
```

### 🎯 **Constructor Dependency Checks**

TypeScript checks the dependency count, type, and position for concrete constructor registrations:

```typescript
class Logger {}
class MailService {}

class EmailService {
  constructor(private logger: Logger, private mailer: MailService) {}
}

const builder = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingleton('mailer', MailService)
  .registerScoped('emailService', EmailService, 'logger', 'mailer');

// TypeScript error: 'mailer' does not provide the Logger parameter.
builder.registerScoped('brokenEmailService', EmailService, 'mailer', 'logger');
```

This check applies to `registerSingleton`, `registerScoped`, `registerTransient`, and their constructor-based `add*` methods.

In development, strict parameter validation also compares each key with the source parameter name. This additional check can find naming mistakes.

Production mode disables the name check because minifiers can change parameter names. The TypeScript type check does not depend on parameter names.

If your key names and parameter names differ, disable only the parameter-name check:
```typescript
const container = new ContainerBuilder()
  .disableStrictParameterValidation()
  .registerSingleton('loggerService', Logger)
  .registerSingleton('mailService', MailService)
  .registerScoped('emailService', EmailService, 'loggerService', 'mailService')
  .build();
```

## 🔄 Working with Scopes

Scopes provide service isolation for request processing, transactions, and multi-tenant scenarios:

### 🌐 **HTTP Request Processing**

```typescript
const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)              // Shared across all requests
  .registerScoped('RequestContext', RequestContext) // Unique per request
  .registerScoped('UserService', UserService, 'Logger', 'RequestContext')
  .build();

// Express.js middleware
app.use((req, res, next) => {
  req.scope = container.startScope(); // Create request scope
  res.on('finish', () => req.scope.dispose()); // Cleanup when done
  next();
});

app.get('/users/:id', (req, res) => {
  const userService = req.scope.get('UserService'); // Request-specific instance
  const user = userService.getUser(req.params.id);
  res.json(user);
});
```

### 💾 **Database Transactions**

```typescript
// Register a scoped connection factory — each scope gets its own connection
const container = new ContainerBuilder()
  .registerSingleton('Config', ConfigService)
  .registerScopedFactory('Connection', (provider) => {
    const config = provider.get('Config');
    return createConnection(config.databaseUrl);
  })
  .registerScoped('UserRepository', UserRepository, 'Connection')
  .registerScoped('OrderRepository', OrderRepository, 'Connection')
  .build();

async function withTransaction<T>(work: (scope: TypeSafeServiceLocator<any>) => Promise<T>): Promise<T> {
  const transactionScope = container.startScope();
  const connection = transactionScope.get('Connection');

  try {
    await connection.beginTransaction();
    const result = await work(transactionScope);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    // Await async cleanup so the connection's dispose (e.g. pool.release())
    // settles before this function resolves.
    await transactionScope.disposeAsync();
  }
}

// Usage — repositories in the same scope share the same connection
await withTransaction(async (txScope) => {
  const userRepo = txScope.get('UserRepository');
  const orderRepo = txScope.get('OrderRepository');

  const user = await userRepo.create({ name: 'John' });
  await orderRepo.create({ userId: user.id, total: 100 });
});
```

### 🧹 **Async Disposal**

Use `disposeAsync()` for services that hold asynchronous resources. The sync `dispose()` method cannot wait for Promise-based cleanup.

```typescript
class DatabasePool {
  async dispose() {
    await this.pool.end(); // async cleanup
  }
}

const container = new ContainerBuilder()
  .registerSingleton('Pool', DatabasePool)
  .build();

// TC39 explicit resource management
{
  await using scope = container.startScope();
  // ...work...
} // scope.disposeAsync() called automatically at block exit

// Waits for consumer cleanup before dependency cleanup
await container.disposeAsync();
```

Use `dispose()` instead when every service has synchronous cleanup. Do not call
both methods on one container. The first call disposes the container, and later
calls are no-ops.

Services can implement `dispose()`, `[Symbol.dispose]()`, or `[Symbol.asyncDispose]()`. Kizuna uses `Symbol.asyncDispose` before `Symbol.dispose` and `dispose()` for asynchronous cleanup.

Kizuna checks object and function values from singleton and scoped factories for cleanup hooks.

`dispose()` invokes consumer cleanup before dependency cleanup. It cannot wait for asynchronous consumer cleanup.

`disposeAsync()` waits for all consumer cleanup before it starts dependency cleanup. It runs services without dependency links in parallel.

Both methods attempt all cleanup operations. If one or more operations fail,
`dispose()` throws a `DisposalError`. The `disposeAsync()` method rejects with
the same error type. The `errors` property contains the original errors. Kizuna
does not write these errors to the console.

`DisposalError` extends the JavaScript `AggregateError` class. It reports
multiple cleanup errors and does not represent a domain aggregate.

If a cleanup method returns a Promise during `dispose()`, the `DisposalError`
contains a `TypeError`. This error tells you to use `disposeAsync()`. The cleanup
has started, but `dispose()` cannot wait for it.

This order includes all services under a multi-registration key. Sync cleanup keeps registration order within each disposal layer.

Async order between independent branches depends on completion timing. If cleanup order is required, declare a dependency.

Factory registrations do not declare dependency keys. Thus, service lookups inside a factory do not affect the disposal order.

## 🏗️ Advanced Patterns

### 🌍 **Multiple Containers for Domain Separation**

An application can use separate containers for separate domains. Kizuna keeps
their registries separate. Your application still defines and enforces each
domain boundary.

Use `borrowSingletonFrom()` when a domain needs one shared singleton. The source
container remains the sole owner. The borrowed key also remains visible in the
domain dependency graph.

```typescript
// Shared infrastructure
const Config = interfaceToken<IConfig>()('Config');

const sharedContainer = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerSingleton('EmailService', EmailService, 'Logger')
  .registerSingletonInterface(Config, DatabaseConfig)
  .build();

// User domain container
const userContainer = new ContainerBuilder()
  .borrowSingletonFrom(sharedContainer, 'Logger')
  .borrowSingletonFrom(sharedContainer, 'EmailService')
  .registerScoped('UserService', UserService, 'Logger')
  .registerScoped('UserNotificationService', UserNotificationService, 'EmailService')
  .build();

// Order domain container
const orderContainer = new ContainerBuilder()
  .borrowSingletonFrom(sharedContainer, 'Logger')
  .registerScoped('OrderService', OrderService, 'Logger')
  .registerScoped('PaymentService', PaymentService, 'Logger')
  .build();

const userScope = userContainer.startScope();
const orderScope = orderContainer.startScope();

try {
  const userService = userScope.get('UserService');
  const orderService = orderScope.get('OrderService');
} finally {
  userScope.dispose();
  orderScope.dispose();
}

// Dispose borrowers before their source.
userContainer.dispose();
orderContainer.dispose();
sharedContainer.dispose();
```

The source registration must be a singleton. Scoped, transient, and
multi-service registrations cannot be borrowed. The source container must
outlive all borrowers and their scopes. A borrower never runs cleanup hooks on
the borrowed value.

### 🧪 **Testing with Type-Safe Mocks**

```typescript
describe('UserService', () => {
  let testContainer: TypeSafeServiceLocator<any>;
  
  beforeEach(() => {
    testContainer = new ContainerBuilder()
      .registerSingletonFactory('Logger', () => ({
        log: jest.fn(),
        error: jest.fn()
      } as any))
      .registerSingletonFactory('Database', () => mockDatabase)
      .registerScoped('UserService', UserService, 'Database', 'Logger')
      .build();
  });
  
  it('should create user with mocked dependencies', async () => {
    const userService = testContainer.get('UserService'); // Type: UserService ✨
    const user = await userService.createUser({ name: 'Test User' });
    expect(user.id).toBeDefined();
  });
});
```

### ⚙️ **Environment-Specific Configuration**

```typescript
const container = new ContainerBuilder()
  .registerSingletonFactory('Config', () => ({
    environment: process.env.NODE_ENV || 'development',
    database: { url: process.env.DATABASE_URL },
    redis: { url: process.env.REDIS_URL }
  }))
  
  .registerSingletonFactory('EmailService', (provider) => {
    const config = provider.get('Config');
    
    // Environment-specific implementations
    return config.environment === 'production'
      ? new SMTPEmailService(config.smtp)
      : new MockEmailService();
  })
  
  .registerSingletonFactory('Cache', (provider) => {
    const config = provider.get('Config');
    
    return config.redis.url
      ? new RedisCache(config.redis.url)
      : new InMemoryCache();
  })
  
  .build();
```

## 📚 Examples

Check out comprehensive examples in the [`examples/`](./examples) directory:

- **[`unified-container-example.ts`](./examples/unified-container-example.ts)** - Complete unified API demonstration
- **[`multiple-containers-domain-separation.ts`](./examples/multiple-containers-domain-separation.ts)** - E-commerce app with domain separation
- **[`validation-example.ts`](./examples/validation-example.ts)** - Configuration validation patterns

## 📖 API Reference

### Package Exports

The package root exports four runtime values:

- `ContainerBuilder`
- `interfaceToken`
- `ServiceProviderToken`
- `CircularDependencyError`

It also exports the `TypeSafeServiceLocator` and `InterfaceToken` types. Concrete
providers, lifecycle classes, wrappers, and builder helper types are internal.

Read the [public API hardening migration](./docs/migrations/public-api-hardening.md)
when you update code that imported an internal symbol.

### interfaceToken

Creates a reusable token that carries an interface type and one fixed string key:

```typescript
const EmailService = interfaceToken<IEmailService>()('EmailService');
```

Pass the token to an interface registration method, `container.get()`,
`container.getAll()`, or a constructor dependency list.

### ContainerBuilder

The main class for configuring your dependency injection container.

#### Constructor Registration Methods

```typescript
// Singleton lifecycle
.registerSingleton<K, TCtor>(key: LiteralServiceKey<K>, serviceType: TCtor, ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>)
.registerSingletonInterface<TToken extends InterfaceToken<unknown, string>, TCtor extends ServiceConstructor>(token: TToken, implementationType: InterfaceImplementationConstructor<InterfaceTokenService<TToken>, TCtor>, ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>)
.registerSingletonFactory<K, T>(key: LiteralServiceKey<K>, factory: (provider: TypeSafeServiceLocator<TRegistry>) => T)

// Scoped lifecycle (one instance per scope)
.registerScoped<K, TCtor>(key: LiteralServiceKey<K>, serviceType: TCtor, ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>)
.registerScopedInterface<TToken extends InterfaceToken<unknown, string>, TCtor extends ServiceConstructor>(token: TToken, implementationType: InterfaceImplementationConstructor<InterfaceTokenService<TToken>, TCtor>, ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>)
.registerScopedFactory<K, T>(key: LiteralServiceKey<K>, factory: (provider: TypeSafeServiceLocator<TRegistry>) => T)

// Transient lifecycle (new instance every time)
.registerTransient<K, TCtor>(key: LiteralServiceKey<K>, serviceType: TCtor, ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>)
.registerTransientInterface<TToken extends InterfaceToken<unknown, string>, TCtor extends ServiceConstructor>(token: TToken, implementationType: InterfaceImplementationConstructor<InterfaceTokenService<TToken>, TCtor>, ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>)
.registerTransientFactory<K, T>(key: LiteralServiceKey<K>, factory: (provider: TypeSafeServiceLocator<TRegistry>) => T)
```

`LiteralServiceKey`, `InterfaceTokenService`, `InterfaceImplementationConstructor`, `ConstructorParameterTuples`, and `DependencyKeys` are internal types. The builder infers them from each call.

#### Multi-Registration Methods

```typescript
// Append services under a shared key (resolved via getAll())
.addSingleton<K, TCtor>(key: LiteralServiceKey<K>, serviceType: TCtor, ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>)
.addScoped<K, TCtor>(key: LiteralServiceKey<K>, serviceType: TCtor, ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>)
.addTransient<K, TCtor>(key: LiteralServiceKey<K>, serviceType: TCtor, ...dependencies: DependencyKeys<TRegistry, ConstructorParameterTuples<TCtor>>)
.addSingletonFactory<K, T>(key: LiteralServiceKey<K>, factory: (provider: TypeSafeServiceLocator<TRegistry>) => T)
.addScopedFactory<K, T>(key: LiteralServiceKey<K>, factory: (provider: TypeSafeServiceLocator<TRegistry>) => T)
.addTransientFactory<K, T>(key: LiteralServiceKey<K>, factory: (provider: TypeSafeServiceLocator<TRegistry>) => T)
```

#### Container Management

```typescript
.build(): TypeSafeServiceLocator<TRegistry>            // Build the container
.validate(): string[]                                  // Validate configuration
.disableStrictParameterValidation(): ContainerBuilder  // Disable param name validation (auto-off in production)
.count: number                                         // Number of registered services
.isRegistered(key: string): boolean                    // Check if service is registered
.getRegisteredServiceNames(): string[]                 // List all registered keys
```

### TypeSafeServiceLocator

The built container interface for service resolution.

```typescript
interface TypeSafeServiceLocator<TRegistry> {
  get<K extends keyof TRegistry>(key: K): TRegistry[K];      // Resolve service
  get(token: typeof ServiceProviderToken): TypeSafeServiceLocator<TRegistry>; // Get current locator
  getAll<K extends keyof TRegistry>(key: K): TRegistry[K][]; // Resolve all implementations as array
  startScope(): TypeSafeServiceLocator<TRegistry>;            // Create new scope
  dispose(): void;                                            // Synchronous cleanup
  disposeAsync(): Promise<void>;                              // Await async cleanup (DB pools, etc.)
  [Symbol.dispose](): void;                                   // TC39 `using` syntax
  [Symbol.asyncDispose](): Promise<void>;                     // TC39 `await using` syntax
}
```

Disposal attempts all cleanup operations before it reports failures. The sync
API throws one `DisposalError`. The async API rejects with one `DisposalError`
after all cleanup operations settle. The resource-management symbols use the
same behavior.

`ServiceProviderToken` is an explicit infrastructure token. Calling
`container.get(ServiceProviderToken)` returns the current root or scoped
locator. This symbol token is separate from the string key `"ServiceProvider"`.
That string remains available for normal user registrations. Other constructors
are not resolution keys. Resolve registered services through their string keys.

### Promise Factory Values

Factory methods are synchronous container operations. An `async` factory returns
a `Promise`. Singleton and scoped lifecycles wrap this value in an observer
`Promise` and cache it while it is pending or fulfilled.

All consumers share the stored `Promise`. It has the same result or rejection as
the factory `Promise`, but it can have a different object identity.

For singleton and scoped factories, TypeScript normalizes a `PromiseLike<T>`
result to `Promise<Awaited<T>>`. Custom properties from a Promise subclass or
thenable are not available on the stored Promise. Transient factories return
their exact factory value.

`get()` does not await the `Promise`. Each consumer must await the returned
value. `disposeAsync()` waits for a stored singleton or scoped `Promise`. It then
cleans the resolved value with the standard cleanup-hook priority.

If a stored `Promise` rejects, its active lifecycle removes it from the cache.
The next `get()` call invokes the factory again. The lifecycle does not retry
automatically. The stored `Promise` rethrows the original rejection. Consumers
must handle it. An ignored rejection remains visible to the runtime.

If disposal starts while a `Promise` is pending, the lifecycle keeps ownership.
`disposeAsync()` reports a later rejection in its `DisposalError`.

`dispose()` starts the cleanup chain but cannot wait for it. Its `DisposalError`
contains a `TypeError` that tells the caller to use `disposeAsync()`.

Transient values are not tracked. The container cannot clean a value from a
transient Promise factory.

### Service Lifecycles

- **Singleton**: One instance per container (application lifetime)
- **Scoped**: One instance per scope (request/transaction lifetime)  
- **Transient**: New instance every time requested

## 🌍 Runtime Support

Kizuna works across different JavaScript environments:

- **Node.js**: Version 18.0.0 and above
- **Browsers**: Modern browsers supporting ES2020+
- **Edge Environments**: Cloudflare Workers, Vercel Edge Functions, etc.
- **Other Runtimes**: Deno, Bun, and other JavaScript runtimes

### 🌐 Edge Runtimes (Workers, Vercel Edge)

Kizuna is built for edge runtimes: **~10 KB gzipped**, zero Node-API dependencies (only `process.env` access is guarded behind a `typeof process` check), no module-level mutable state that could leak across isolate-reused requests.

**Recommended Cloudflare Workers pattern:**

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

// Built once per isolate at module load — cheap (no service is instantiated here)
const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerScoped('RequestContext', RequestContext)
  .registerScoped('UserService', UserService, 'Logger', 'RequestContext')
  .build();

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const scope = container.startScope();
    try {
      // Use the scope synchronously inside the handler
      return await handle(req, scope);
    } finally {
      // Schedule async cleanup AFTER the scope was used. ctx.waitUntil lets it
      // run after the response is sent, without adding latency to the request.
      // (Calling disposeAsync earlier would mark the scope disposed and break
      // any service resolution still happening in handle().)
      ctx.waitUntil(scope.disposeAsync());
    }
  }
};
```

**Vercel Edge Function pattern:**

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerScoped('RequestContext', RequestContext)
  .build();

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // `await using` ensures disposeAsync runs even on throw
  await using scope = container.startScope();
  return handle(req, scope);
}
```

#### ⚠️ Isolate reuse: don't put request state in singletons

Edge runtimes reuse the same isolate across requests. A `Singleton` lives for the lifetime of the isolate — **across users**. If a singleton accidentally captures request-specific state (auth tokens, user IDs, tenant data), that state leaks to the next request served by the same isolate.

This is not a Kizuna bug — it's the definition of `Singleton`. But the failure mode is more dangerous on the edge than on a per-process server, because isolate-sharing is invisible by default.

**Rule of thumb:**
- `Singleton`: stateless services, configuration, infrastructure clients with their own pooling (DB clients, KV bindings, loggers)
- `Scoped`: anything touching the current request (`RequestContext`, per-request DB transactions, auth state)
- `Transient`: lightweight per-call helpers (UUID generators, timestamps)

#### Strict parameter validation under minification

`strictParameterValidation` inspects `constructor.toString()` to match dependency names to parameter names. Edge bundlers mangle parameter names during minification, which would produce false warnings — so Kizuna **auto-disables this check when `NODE_ENV === 'production'`**. No opt-out required for edge deploys; the check still runs in development to catch real ordering bugs early.

## ⚡ Concurrency Considerations

**Important**: Kizuna is optimized for JavaScript's single-threaded model and is **not thread-safe**. For concurrent environments:

### Safe Patterns ✅
```typescript
// Container-per-worker (recommended)
const worker = new Worker('worker.js');
// Each worker creates its own container

// Request-scoped isolation (web servers)
app.use((req, res, next) => {
    req.services = rootContainer.startScope(); // Isolated per request
    res.on('finish', () => req.services.dispose());
});
```

### Unsafe Patterns ❌
```typescript
// DON'T share containers across threads
const sharedContainer = builder.build();
worker1.postMessage({ container: sharedContainer }); // ❌ Race conditions
worker2.postMessage({ container: sharedContainer }); // ❌ Unsafe
```

**📖 For detailed guidance, see our [Concurrency Patterns Guide](./docs/concurrency-patterns.md)**

## 📝 TypeScript

Kizuna is built with TypeScript and provides comprehensive type safety. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true
  }
}
```

## 🤝 Contributing

Contributions are welcome. Add a changeset when a change affects package users.
See the [release process](./docs/releases.md) for version and changelog rules.

## 📜 License

MIT - see [LICENSE](./LICENSE) file for details.

## 🙏 Credits

This project was inspired by the foundational work of Remi Henache on the [injected-ts](https://github.com/remihenache/injected-ts) library.

---

**Kizuna** (絆) - Creating strong bonds between your application's services through dependency injection. 🤝

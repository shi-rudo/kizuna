# Kizuna 絆

> **⚠️ Beta Release Notice**  
> Kizuna is currently in beta. While the core functionality is stable and production use can be considered, there may be small API changes and improvements based on community feedback. We recommend thorough testing before production deployment.

A lightweight, type-safe dependency injection container for TypeScript and JavaScript applications. Kizuna provides a unified, intuitive API for managing service lifecycles with complete type safety and IDE autocompletion.

## ✨ Features

- **🎯 Complete Type Safety**: Full TypeScript support with automatic type inference
- **🚀 Unified API**: Single API supporting all registration patterns with excellent DX
- **🔄 Multiple Lifecycles**: Singleton, Scoped, and Transient service management
- **🏭 Flexible Registration**: Constructor, interface, and factory-based service registration
- **🛡️ Parameter Validation**: Automatic validation of dependency names vs constructor parameters
- **📝 Perfect IDE Support**: Full autocompletion and compile-time validation
- **⚡ Zero Dependencies**: Lightweight with no external dependencies
- **🌍 Universal**: Works in Node.js, browsers, and edge environments

## 🚀 Quick Start

```bash
npm install @shirudo/kizuna
```

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
  .registerSingleton('Database', DatabaseService, 'Logger') // Dependencies as strings
  .registerScoped('UserService', UserService, 'Database', 'Logger')
  .build();

// ✅ Get services with perfect IDE autocompletion
const userService = container.get('UserService'); // Type: UserService (auto-inferred!)
const user = userService.getUser('123');          // Full IntelliSense support
```

## 🎨 The Unified API

Kizuna provides a single, comprehensive API that combines the best of both type safety and flexibility. All registration patterns work together seamlessly with full type inference.

### 🏗️ **Constructor Registration** (Most Common)

Perfect for services with constructor dependencies:

```typescript
const container = new ContainerBuilder()
  .registerSingleton('Config', ConfigService)
  .registerScoped('UserService', UserService, 'Config')      // Dependencies as strings
  .registerTransient('EmailService', EmailService, 'Config')
  .build();

// IDE suggests: 'Config', 'UserService', 'EmailService'
const userService = container.get('UserService'); // Type: UserService ✨
```

### 🎯 **Interface Registration** (For Abstractions)

Ideal for implementing abstractions and polymorphism:

```typescript
interface IEmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

class SMTPEmailService implements IEmailService {
  async send(to: string, subject: string, body: string) { /* implementation */ }
}

const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerSingletonInterface<IEmailService>('EmailService', SMTPEmailService, 'Logger')
  .registerScopedInterface<ICache>('Cache', RedisCache, 'Logger')
  .build();

const emailService = container.get('EmailService'); // Type: IEmailService ✨
```

### 🏭 **Factory Registration** (For Complex Creation)

Perfect for complex initialization, conditional logic, or primitive values:

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
    email: (value: string) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value),
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
const container = new ContainerBuilder()
  // Singleton services (shared across entire application)
  .registerSingleton('Config', ConfigService)
  .registerSingletonInterface<ILogger>('Logger', ConsoleLogger)
  .registerSingletonFactory('Database', (provider) => createConnection())
  
  // Scoped services (shared within scope, new per scope)
  .registerScoped('RequestContext', RequestContext, 'Logger')
  .registerScopedInterface<ICache>('Cache', MemoryCache, 'Logger')
  .registerScopedFactory('RequestId', () => crypto.randomUUID())
  
  // Transient services (new instance every time)
  .registerTransient('EmailService', EmailService, 'Logger')
  .registerTransientInterface<IValidator>('Validator', DefaultValidator)
  .registerTransientFactory('Timestamp', () => Date.now())
  
  .build();
```

## 🎯 Complete Type Safety

Kizuna provides compile-time type checking and perfect IDE integration:

### ✅ **Compile-Time Validation**

```typescript
const container = new ContainerBuilder()
  .registerSingleton('UserService', UserService, 'Logger')
  .build();

// ❌ TypeScript Error: 'NonExistent' doesn't exist in registry
const invalid = container.get('NonExistent');

// ✅ Perfect autocompletion suggests only registered services
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

### 🎯 **Strict Parameter Validation**

Kizuna automatically validates that your dependency names match constructor parameter names, preventing runtime errors from incorrect dependency order:

```typescript
class EmailService {
  // Constructor parameters: logger, mailer
  constructor(private logger: Logger, private mailer: MailService) {}
}

// ❌ Wrong parameter order - will fail validation
const builder = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerSingleton('MailService', MailService, 'Logger')
  .registerScoped('EmailService', EmailService, 'MailService', 'Logger'); // Wrong order!

const issues = builder.validate();
// Returns: [
//   "Service 'EmailService' parameter 0 is named 'logger' but dependency 'MailService' is provided",
//   "Service 'EmailService' parameter 1 is named 'mailer' but dependency 'Logger' is provided"
// ]

// ✅ Correct parameter order - validation passes
const correctBuilder = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerSingleton('MailService', MailService, 'Logger')
  .registerScoped('EmailService', EmailService, 'logger', 'mailer'); // Matches constructor!

correctBuilder.validate(); // Returns: [] (no issues)
```

**Key Benefits:**
- **🛡️ Prevents Runtime Errors**: Catches dependency order mismatches at validation time
- **🎯 Enabled by Default**: Works automatically with no setup required
- **💡 Helpful Suggestions**: Provides corrected registration examples in error messages
- **🔧 Opt-out Available**: Can be disabled if needed with `.disableStrictParameterValidation()`

**When Parameter Validation Helps:**
```typescript
// Before: Runtime error when EmailService tries to use dependencies
class EmailService {
  constructor(private logger: Logger, private config: ConfigService) {}
  
  sendEmail() {
    this.logger.log('Sending email...'); // 💥 Runtime error if dependencies swapped!
  }
}

// After: Validation catches the error before runtime
builder.validate(); // Catches parameter name mismatches early
```

**Disable if needed** (not recommended):
```typescript
const container = new ContainerBuilder()
  .disableStrictParameterValidation() // Turn off validation
  .registerScoped('EmailService', EmailService, 'config', 'logger') // Order doesn't matter
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
async function withTransaction<T>(work: (scope: ServiceLocator) => Promise<T>): Promise<T> {
  const transactionScope = container.startScope();
  
  try {
    // Register transaction-specific connection
    const connection = await createConnection();
    transactionScope.registerInstance('Connection', connection);
    
    await connection.beginTransaction();
    const result = await work(transactionScope);
    await connection.commit();
    
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    transactionScope.dispose(); // Always cleanup
  }
}

// Usage
await withTransaction(async (txScope) => {
  const userRepo = txScope.get('UserRepository'); // Uses transaction connection
  const orderRepo = txScope.get('OrderRepository'); // Same transaction
  
  const user = await userRepo.create({ name: 'John' });
  await orderRepo.create({ userId: user.id, total: 100 });
});
```

## 🏗️ Advanced Patterns

### 🌍 **Multiple Containers for Domain Separation**

For complex applications, separate containers maintain domain boundaries:

```typescript
// Shared infrastructure
const sharedContainer = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerSingleton('EmailService', EmailService, 'Logger')
  .registerSingletonInterface<IConfig>('Config', DatabaseConfig)
  .build();

// User domain container
const userContainer = new ContainerBuilder()
  .registerSingletonFactory('Logger', () => sharedContainer.get('Logger'))
  .registerSingletonFactory('EmailService', () => sharedContainer.get('EmailService'))
  .registerScoped('UserService', UserService, 'Logger')
  .registerScoped('UserNotificationService', UserNotificationService, 'EmailService')
  .build();

// Order domain container
const orderContainer = new ContainerBuilder()
  .registerSingletonFactory('Logger', () => sharedContainer.get('Logger'))
  .registerScoped('OrderService', OrderService, 'Logger')
  .registerScoped('PaymentService', PaymentService, 'Logger')
  .build();

// Each domain has isolated services but shares infrastructure
const userService = userContainer.startScope().get('UserService');
const orderService = orderContainer.startScope().get('OrderService');
```

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

### ContainerBuilder

The main class for configuring your dependency injection container.

#### Constructor Registration Methods

```typescript
// Singleton lifecycle
.registerSingleton<K, T>(key: K, serviceType: new (...args: any[]) => T, ...dependencies: string[])
.registerSingletonInterface<T, K>(key: K, implementationType: new (...args: any[]) => T, ...dependencies: string[])
.registerSingletonFactory<K, T>(key: K, factory: (provider: TypeSafeServiceLocator<TRegistry>) => T)

// Scoped lifecycle (one instance per scope)
.registerScoped<K, T>(key: K, serviceType: new (...args: any[]) => T, ...dependencies: string[])
.registerScopedInterface<T, K>(key: K, implementationType: new (...args: any[]) => T, ...dependencies: string[])
.registerScopedFactory<K, T>(key: K, factory: (provider: TypeSafeServiceLocator<TRegistry>) => T)

// Transient lifecycle (new instance every time)
.registerTransient<K, T>(key: K, serviceType: new (...args: any[]) => T, ...dependencies: string[])
.registerTransientInterface<T, K>(key: K, implementationType: new (...args: any[]) => T, ...dependencies: string[])
.registerTransientFactory<K, T>(key: K, factory: (provider: TypeSafeServiceLocator<TRegistry>) => T)
```

#### Container Management

```typescript
.build(): TypeSafeServiceLocator<TRegistry>        // Build the container
.validate(): string[]                              // Validate configuration
.clear(): ContainerBuilder                         // Clear all registrations
.disableStrictParameterValidation(): ContainerBuilder  // Disable parameter name validation
.count: number                                    // Number of registered services
.isRegistered(key: string): boolean               // Check if service is registered
```

### TypeSafeServiceLocator

The built container interface for service resolution.

```typescript
interface TypeSafeServiceLocator<TRegistry> {
  get<K extends keyof TRegistry>(key: K): TRegistry[K];  // Resolve service
  startScope(): TypeSafeServiceLocator<TRegistry>;      // Create new scope
  dispose(): void;                                      // Cleanup resources
}
```

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

Kizuna is built with TypeScript and provides complete type safety. Ensure your `tsconfig.json` includes:

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

Contributions are welcome! Please feel free to submit a Pull Request.

## 📜 License

MIT - see [LICENSE](./LICENSE) file for details.

## 🙏 Credits

This project was inspired by the foundational work of Remi Henache on the [injected-ts](https://github.com/remihenache/injected-ts) library.

---

**Kizuna** (絆) - Creating strong bonds between your application's services through dependency injection. 🤝
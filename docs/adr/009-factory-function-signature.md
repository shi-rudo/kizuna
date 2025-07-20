# ADR-009: Factory Function Signature

## Status

Accepted

## Context

Kizuna needed to design the signature for factory functions used in service registration. Three primary approaches were considered:

1. **ServiceProvider Parameter**: Factory receives the ServiceProvider for dependency resolution
2. **Pre-resolved Dependencies**: Factory receives already resolved dependencies as parameters
3. **Dependency Object**: Factory receives a dependency object with named properties

## Decision

We chose the **ServiceProvider Parameter** approach where factory functions receive the ServiceProvider as their parameter.

## Rationale

### Factory Function Signature

```typescript
type Factory<T> = (serviceProvider: ServiceLocator) => T | Promise<T>;

// Usage example
builder.addSingleton((r) =>
  r.fromName("DatabaseService").useFactory((provider: ServiceProvider) => {
    const config = provider.get<Config>("Config");
    const logger = provider.get<Logger>("Logger");
    return new DatabaseService(config.connectionString, logger);
  })
);
```

### Benefits of ServiceProvider Parameter

#### 1. **Maximum Flexibility**

```typescript
// Conditional dependency resolution
builder.addSingleton((r) =>
  r.fromName("NotificationService").useFactory((provider: ServiceProvider) => {
    const config = provider.get<AppConfig>("AppConfig");

    if (config.useEmailNotifications) {
      const emailService = provider.get<EmailService>("EmailService");
      return new EmailNotificationService(emailService);
    } else {
      const smsService = provider.get<SMSService>("SMSService");
      return new SMSNotificationService(smsService);
    }
  })
);
```

- Enables runtime dependency selection based on configuration
- Supports complex initialization logic with multiple dependency paths
- Allows factories to resolve different services based on conditions

#### 2. **Dynamic Service Discovery**

```typescript
// Plugin-based architecture
builder.addSingleton((r) =>
  r.fromName("PluginManager").useFactory((provider: ServiceProvider) => {
    const config = provider.get<PluginConfig>("PluginConfig");
    const enabledPlugins = config.enabledPlugins;

    const plugins = enabledPlugins.map((pluginName) => {
      const pluginKey = `Plugin_${pluginName}`;
      return provider.get<IPlugin>(pluginKey);
    });

    return new PluginManager(plugins);
  })
);
```

- Supports discovery and resolution of services based on runtime configuration
- Enables plugin architectures with dynamic plugin loading
- Allows factories to resolve collections of services

#### 3. **Async Initialization Support**

```typescript
// Async factory with dependent async services
builder.addSingleton((r) =>
  r.fromName("AsyncService").useFactory(async (provider: ServiceProvider) => {
    const config = await provider
      .get<ConfigService>("ConfigService")
      .loadConfig();
    const connection = await provider
      .get<DatabaseService>("DatabaseService")
      .connect();

    const service = new AsyncService(config, connection);
    await service.initialize();
    return service;
  })
);
```

- Factory can await resolution of async services
- Supports complex async initialization sequences
- Enables async factories without changing container API

#### 4. **Scope-Aware Factory Creation**

```typescript
// Factory that creates scoped services
builder.addScoped((r) =>
  r.fromName("RequestProcessor").useFactory((provider: ServiceProvider) => {
    const requestScope = provider.startScope();
    const processor = new RequestProcessor(requestScope);

    // Processor manages its own scope lifecycle
    return processor;
  })
);
```

- Factories can create and manage scopes
- Enables sophisticated lifetime management patterns
- Supports request-scoped service creation

### Implementation Details

#### Factory Type Definition

```typescript
type Factory<T> = (serviceProvider: ServiceLocator) => T | Promise<T>;
```

#### Factory Execution in Lifecycle

```typescript
class SingletonLifecycle implements Container {
  private _instance: any = null;

  constructor(
    private readonly _factory: Factory<any>,
    private readonly _dependencies: readonly ServiceKey<any>[]
  ) {}

  resolve(serviceProvider: ServiceLocator): any {
    if (this._instance === null) {
      // Factory receives the ServiceProvider directly
      this._instance = this._factory(serviceProvider);
    }
    return this._instance;
  }
}
```

#### Dependency Resolution Within Factory

```typescript
// Factory has full control over dependency resolution
const factory: Factory<ComplexService> = (provider: ServiceProvider) => {
  // Resolve dependencies explicitly
  const dependency1 = provider.get<Dependency1>("Dependency1");
  const dependency2 = provider.get<Dependency2>("Dependency2");

  // Complex construction logic
  const service = new ComplexService(dependency1);
  service.configure(dependency2);

  return service;
};
```

### Trade-offs Accepted

#### Advantages

- **Maximum Flexibility**: Factory controls all aspects of service creation
- **Dynamic Resolution**: Can resolve different services based on runtime conditions
- **Async Support**: Natural support for async initialization patterns
- **Scope Management**: Factories can create and manage scopes
- **Complex Logic**: Supports sophisticated service construction scenarios

#### Disadvantages

- **Service Locator Pattern**: Encourages service locator usage within factories
- **Hidden Dependencies**: Factory dependencies not declared in registration
- **Testing Complexity**: Harder to mock dependencies for factory testing
- **Potential Misuse**: Easy to abuse for non-factory scenarios

### Alternatives Considered

#### Pre-resolved Dependencies Parameter

```typescript
// Rejected approach
type Factory<T, TDeps extends any[]> = (...dependencies: TDeps) => T;

// Registration would specify dependencies
builder.addSingleton((r) =>
  r
    .fromName("Service")
    .useFactory(
      (dep1: Dependency1, dep2: Dependency2) => new Service(dep1, dep2)
    )
    .withDependencies("Dependency1", "Dependency2")
);
```

- **Rejected**: Limited to pre-declared dependencies
- **Rejected**: Cannot handle conditional or dynamic dependency resolution
- **Rejected**: Complex type system to maintain dependency parameter alignment

#### Dependency Object Parameter

```typescript
// Rejected approach
type Factory<T> = (dependencies: Record<string, any>) => T;

// Usage
builder.addSingleton((r) =>
  r
    .fromName("Service")
    .useFactory((deps) => {
      const dep1 = deps["Dependency1"] as Dependency1;
      const dep2 = deps["Dependency2"] as Dependency2;
      return new Service(dep1, dep2);
    })
    .withDependencies("Dependency1", "Dependency2")
);
```

- **Rejected**: Loss of type safety for dependency access
- **Rejected**: Verbose casting required for each dependency
- **Rejected**: Still limited to pre-declared dependencies

#### Dependency Injection Container Parameter

```typescript
// Rejected approach
interface IDependencyContainer {
  resolve<T>(key: string): T;
}

type Factory<T> = (container: IDependencyContainer) => T;
```

- **Rejected**: Additional abstraction layer without clear benefit
- **Rejected**: Would require maintaining separate interface
- **Rejected**: ServiceProvider already provides the needed functionality

## Implementation Pattern

### Basic Factory Usage

```typescript
// Simple factory with dependency resolution
builder.addSingleton((r) =>
  r.fromName("EmailService").useFactory((provider: ServiceProvider) => {
    const config = provider.get<EmailConfig>("EmailConfig");
    return new EmailService(config.smtpHost, config.smtpPort);
  })
);
```

### Conditional Service Creation

```typescript
// Factory with runtime decision making
builder.addSingleton((r) =>
  r.fromName("Logger").useFactory((provider: ServiceProvider) => {
    const config = provider.get<AppConfig>("AppConfig");

    return config.isDevelopment
      ? new ConsoleLogger(config.logLevel)
      : new FileLogger(config.logPath, config.logLevel);
  })
);
```

### Async Factory Pattern

```typescript
// Async initialization in factory
builder.addSingleton((r) =>
  r
    .fromName("DatabaseConnection")
    .useFactory(async (provider: ServiceProvider) => {
      const config = provider.get<DatabaseConfig>("DatabaseConfig");
      const connection = new DatabaseConnection(config.connectionString);

      await connection.initialize();
      await connection.runMigrations();

      return connection;
    })
);
```

### Complex Dependency Management

```typescript
// Factory managing multiple dependencies and scopes
builder.addScoped((r) =>
  r.fromName("RequestHandler").useFactory((provider: ServiceProvider) => {
    const scope = provider.startScope();

    const logger = scope.get<Logger>("Logger");
    const metrics = scope.get<MetricsCollector>("MetricsCollector");
    const processor = scope.get<RequestProcessor>("RequestProcessor");

    return new RequestHandler(logger, metrics, processor, scope);
  })
);
```

## Consequences

### Positive

- **Flexibility**: Supports any service creation scenario
- **Dynamic Resolution**: Runtime dependency selection based on conditions
- **Async Support**: Natural support for async initialization
- **Scope Control**: Factories can create and manage scopes
- **Complex Logic**: Handles sophisticated service construction requirements

### Negative

- **Service Locator**: Encourages service locator pattern usage
- **Hidden Dependencies**: Factory dependencies not explicitly declared
- **Testing**: More complex to unit test factory functions
- **Abstraction**: Breaks dependency inversion in some scenarios

## Guidelines

### When to Use Factories

#### Appropriate Use Cases

- **Conditional Creation**: Service type depends on runtime configuration
- **Complex Initialization**: Multi-step initialization requiring multiple services
- **Async Services**: Services requiring async initialization
- **Dynamic Dependencies**: Dependencies determined at runtime
- **Resource Management**: Services requiring special resource handling

#### Avoid Factories For

- **Simple Construction**: Services with straightforward constructor injection
- **Static Dependencies**: Dependencies that never change
- **Pure Functions**: Services that don't require initialization state

### Factory Best Practices

1. **Minimize Complexity**: Keep factory logic as simple as possible
2. **Document Dependencies**: Clearly document what services the factory uses
3. **Error Handling**: Handle resolution errors gracefully
4. **Testing**: Create factory unit tests with mocked ServiceProvider
5. **Type Safety**: Use proper TypeScript types for resolved services

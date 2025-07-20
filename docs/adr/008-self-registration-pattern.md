# ADR-008: Self-Registration Pattern

## Status

Accepted

## Context

Kizuna needed to decide whether the ServiceProvider should be available as a resolvable service within the container itself. Three approaches were considered:

1. **No Self-Registration**: ServiceProvider is not available for injection
2. **Manual Registration**: Users must explicitly register the ServiceProvider
3. **Automatic Self-Registration**: ServiceProvider automatically registers itself

## Decision

We chose **Automatic Self-Registration** where the ServiceProvider automatically registers itself as a singleton service.

## Rationale

### Self-Registration Implementation

```typescript
class ServiceProvider implements ServiceLocator {
  constructor(private readonly registrations: Record<string, Container>) {
    this.addItSelfResolver();
  }

  private addItSelfResolver(): void {
    this.registrations[ServiceProvider.name] = new SingletonLifecycle(
      () => this,
      []
    );
  }
}
```

### Benefits of Self-Registration

#### 1. **Service Locator Pattern Support**

```typescript
// Services can access the container for advanced scenarios
class AdvancedService {
  constructor(private readonly serviceProvider: ServiceProvider) {}

  processWithDynamicDependencies(): void {
    const pluginType = this.determinePluginType();
    const plugin = this.serviceProvider.get(pluginType);
    plugin.execute();
  }
}

// Registration
builder.addSingleton((r) =>
  r.fromType(AdvancedService).withDependencies(ServiceProvider)
);
```

- Enables advanced scenarios requiring dynamic service resolution
- Supports plugin architectures and factory patterns
- Allows services to resolve dependencies conditionally

#### 2. **Factory Pattern Convenience**

```typescript
// Factories can resolve dependencies without parameter passing
builder.addSingleton((r) =>
  r.fromName("DatabaseService").useFactory((provider: ServiceProvider) => {
    const config = provider.get<DatabaseConfig>("DatabaseConfig");
    const logger = provider.get<Logger>("Logger");
    return new DatabaseService(config.connectionString, logger);
  })
);
```

- Factory functions have direct access to ServiceProvider
- No need to manually pass the provider through dependency chains
- Cleaner factory implementations

#### 3. **Scope Access Within Services**

```typescript
class RequestHandler {
  constructor(private readonly serviceProvider: ServiceProvider) {}

  async handleRequest(request: Request): Promise<Response> {
    // Create a scoped container for this request
    const requestScope = this.serviceProvider.startScope();

    try {
      const processor = requestScope.get(RequestProcessor);
      return await processor.process(request);
    } finally {
      requestScope.dispose();
    }
  }
}
```

- Services can create and manage their own scopes
- Enables advanced lifetime management patterns
- Supports request-scoped processing architectures

#### 4. **Consistency with Dependency Injection Principles**

```typescript
// ServiceProvider is just another service dependency
class ServiceA {
  constructor(
    private readonly serviceB: ServiceB,
    private readonly serviceProvider: ServiceProvider
  ) {}
}

// Uniform registration pattern
builder.addSingleton((r) =>
  r.fromType(ServiceA).withDependencies(ServiceB, ServiceProvider)
);
```

- ServiceProvider follows the same injection patterns as other services
- No special handling or different resolution mechanisms needed
- Consistent with standard dependency injection practices

### Implementation Details

#### Automatic Registration

```typescript
constructor(private readonly registrations: Record<string, Container>) {
  // Automatically register itself
  this.addItSelfResolver();
}

private addItSelfResolver(): void {
  this.registrations[ServiceProvider.name] = new SingletonLifecycle(
    () => this,
    []
  );
}
```

#### Type-Safe Resolution

```typescript
// Resolve as constructor type
const provider = container.get(ServiceProvider);

// Resolve as string key
const provider = container.get<ServiceProvider>("ServiceProvider");
```

#### Singleton Behavior

```typescript
// Same instance returned across all resolutions
const provider1 = container.get(ServiceProvider);
const provider2 = container.get(ServiceProvider);
// provider1 === provider2 (same instance)
```

### Trade-offs Accepted

#### Advantages

- **Convenience**: No manual registration required
- **Consistency**: Follows standard dependency injection patterns
- **Flexibility**: Enables advanced service resolution scenarios
- **Factory Support**: Simplifies factory function implementations
- **Scope Management**: Services can manage their own scopes

#### Disadvantages

- **Service Locator Anti-Pattern**: Can lead to service locator usage
- **Hidden Dependencies**: Services may resolve dependencies without declaring them
- **Testing Complexity**: Harder to mock or isolate services using the provider
- **Circular Dependency Risk**: ServiceProvider depends on itself conceptually

### Alternatives Considered

#### No Self-Registration

```typescript
// Rejected approach
class ServiceProvider {
  constructor(private readonly registrations: Record<string, Container>) {
    // No self-registration
  }
}

// ServiceProvider not available for injection
const service = container.get(ServiceProvider); // Would throw error
```

- **Rejected**: Limits advanced scenarios requiring dynamic resolution
- **Rejected**: Makes factory patterns more complex
- **Rejected**: Prevents services from managing scopes

#### Manual Registration Required

```typescript
// Rejected approach
const builder = new ContainerBuilder();

// User must explicitly register the provider
builder.addSingleton((r) =>
  r.fromName("ServiceProvider").useFactory((provider) => provider)
);

const container = builder.build();
```

- **Rejected**: Additional ceremony for common use case
- **Rejected**: Easy to forget, leading to runtime errors
- **Rejected**: Inconsistent behavior across different container instances

#### Interface-Based Registration

```typescript
// Rejected approach
interface IServiceLocator {
  get<T>(key: ServiceKey<T>): T;
}

class ServiceProvider implements IServiceLocator {
  constructor(registrations: Record<string, Container>) {
    this.registrations["IServiceLocator"] = new SingletonLifecycle(
      () => this,
      []
    );
  }
}
```

- **Rejected**: Additional interface abstraction for minimal benefit
- **Rejected**: Users would expect both interface and concrete registration
- **Rejected**: Complicates the API without clear advantages

## Implementation Pattern

### Basic Service Locator Usage

```typescript
class PluginManager {
  constructor(private readonly serviceProvider: ServiceProvider) {}

  loadPlugin(pluginName: string): IPlugin {
    // Dynamic resolution based on configuration
    const pluginKey = `Plugin_${pluginName}`;
    return this.serviceProvider.get<IPlugin>(pluginKey);
  }
}

// Registration
builder.addSingleton((r) =>
  r.fromType(PluginManager).withDependencies(ServiceProvider)
);
```

### Factory with Provider Access

```typescript
// Complex initialization requiring multiple services
builder.addSingleton((r) =>
  r.fromName("EmailService").useFactory((provider: ServiceProvider) => {
    const config = provider.get<EmailConfig>("EmailConfig");
    const logger = provider.get<Logger>("Logger");
    const metrics = provider.get<MetricsCollector>("MetricsCollector");

    return new EmailService(config, logger, metrics);
  })
);
```

### Scope Management in Services

```typescript
class BatchProcessor {
  constructor(private readonly serviceProvider: ServiceProvider) {}

  async processBatch(items: BatchItem[]): Promise<void> {
    for (const item of items) {
      // Create isolated scope for each item
      const itemScope = this.serviceProvider.startScope();

      try {
        const processor = itemScope.get<ItemProcessor>("ItemProcessor");
        await processor.process(item);
      } finally {
        itemScope.dispose();
      }
    }
  }
}
```

## Consequences

### Positive

- **Advanced Patterns**: Enables sophisticated service resolution scenarios
- **Factory Simplicity**: Factories have direct access to the container
- **Scope Control**: Services can manage scopes for specific operations
- **Consistency**: ServiceProvider behaves like any other injected service

### Negative

- **Anti-Pattern Risk**: May encourage service locator usage over dependency injection
- **Hidden Dependencies**: Services can acquire dependencies without declaring them
- **Testing Challenges**: Harder to unit test services that use the provider
- **Complexity**: Can lead to more complex service graphs

## Guidelines

### When to Use ServiceProvider Injection

#### Appropriate Use Cases

- **Factory Implementations**: When creating services dynamically
- **Plugin Architectures**: Loading plugins based on configuration
- **Scope Management**: Creating isolated scopes for specific operations
- **Conditional Resolution**: Resolving different services based on runtime conditions

#### Avoid ServiceProvider Injection For

- **Regular Dependencies**: Use constructor injection instead
- **Configuration**: Inject specific config objects, not the provider
- **Simple Services**: Services with static, known dependencies

### Best Practices

1. **Minimize Usage**: Use sparingly and only for advanced scenarios
2. **Document Intent**: Clearly document why the provider is needed
3. **Consider Alternatives**: Evaluate if the dependency can be injected directly
4. **Test Isolation**: Create test doubles for the provider in unit tests

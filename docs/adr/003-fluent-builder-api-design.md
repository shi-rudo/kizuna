# ADR-003: Fluent Builder API Design

## Status

Accepted

## Context

Kizuna needed to design a registration API that would be both powerful and intuitive. Three primary approaches were considered:

1. **Simple Function-Based API**: Basic registration functions
2. **Configuration Object API**: Single function with configuration objects
3. **Fluent Builder API**: Chainable method calls with specialized builders

## Decision

We chose the **Fluent Builder API** with specialized builder types for different registration patterns.

## Rationale

### API Structure

```typescript
// Type-based registration flow
builder.addSingleton((r) =>
  r.fromType(UserService).withDependencies(DatabaseService, LoggerService)
);

// Name-based registration flow
builder.addSingleton((r) =>
  r
    .fromName("IUserService")
    .useType(UserService)
    .withDependencies("IDatabase", "ILogger")
);

// Factory-based registration flow
builder.addSingleton((r) =>
  r.fromName("ConfigService").useFactory(async (provider) => {
    const config = await loadConfig();
    return new ConfigService(config);
  })
);
```

### Benefits of Fluent Builder Design

#### 1. **Intuitive Reading Flow**

```typescript
// Reads like natural language
builder.addSingleton((r) =>
  r.fromType(EmailService).withDependencies(SMTPClient, Logger)
);
```

- Code expresses intent clearly
- Left-to-right reading flow matches mental model
- Method names correspond to conceptual steps

#### 2. **Type-Guided Development**

```typescript
// IntelliSense guides through valid options
builder.addSingleton(
  (r) =>
    r
      .fromType() // or fromName()
      .useType() // only available after fromName()
      .withDependencies() // available on all paths
);
```

- IDE autocomplete reveals available options at each step
- Impossible to call invalid method combinations
- Compile-time prevention of invalid configurations

#### 3. **Specialized Builder Types**

```typescript
interface TypeServiceBuilder<T> {
  withDependencies<TDeps extends ServiceKey<any>[]>(
    ...dependencies: TDeps
  ): ServiceWrapper<T>;
}

interface NamedServiceBuilder<T> {
  useType<U extends T>(type: Constructor<U>): FactoryServiceBuilder<T>;
  useFactory(factory: Factory<T>): FactoryServiceBuilder<T>;
}

interface FactoryServiceBuilder<T> {
  withDependencies<TDeps extends ServiceKey<any>[]>(
    ...dependencies: TDeps
  ): ServiceWrapper<T>;
}
```

- Each builder exposes only relevant methods for its context
- Type system prevents invalid method chains
- Clear separation of concerns between registration strategies

#### 4. **Flexible Registration Patterns**

```typescript
// Minimal registration
builder.addSingleton((r) => r.fromType(SimpleService));

// With dependencies
builder.addSingleton((r) =>
  r.fromType(ComplexService).withDependencies(Dependency1, Dependency2)
);

// Interface registration
builder.addSingleton((r) =>
  r
    .fromName("IService")
    .useType(ConcreteService)
    .withDependencies("IDependency")
);

// Factory registration
builder.addScoped((r) =>
  r
    .fromName("RequestContext")
    .useFactory((provider) => new RequestContext(uuid.v4()))
);
```

### Implementation Architecture

#### Builder Hierarchy

```typescript
// Entry point for all registrations
class ContainerBuilder {
  addSingleton<T>(configure: (r: ServiceRegistrar) => ServiceWrapper<T>): this;
  addScoped<T>(configure: (r: ServiceRegistrar) => ServiceWrapper<T>): this;
  addTransient<T>(configure: (r: ServiceRegistrar) => ServiceWrapper<T>): this;
}

// Provides initial registration options
class ServiceRegistrar {
  fromType<T>(type: Constructor<T>): TypeServiceBuilder<T>;
  fromName<T>(name: string): NamedServiceBuilder<T>;
}
```

#### Method Chaining Implementation

```typescript
class TypeServiceBuilder<T> implements TypeServiceBuilder<T> {
  constructor(private readonly _type: Constructor<T>) {}

  withDependencies<TDeps extends ServiceKey<any>[]>(
    ...dependencies: TDeps
  ): ServiceWrapper<T> {
    return new ServiceWrapper(this._type.name, this._type, dependencies);
  }
}
```

### Trade-offs Accepted

#### Advantages

- **Developer Experience**: Intuitive, discoverable API
- **Type Safety**: Compile-time validation of registration chains
- **Readability**: Code reads like domain language
- **IDE Support**: Excellent IntelliSense and autocomplete
- **Extensibility**: Easy to add new builder methods without breaking changes

#### Disadvantages

- **API Complexity**: Multiple builder types to understand and maintain
- **Bundle Size**: Additional classes and methods increase library size
- **Learning Curve**: Developers must understand the builder pattern
- **Indirection**: More method calls than simple function-based approach

### Alternatives Considered

#### Simple Function-Based API

```typescript
// Rejected approach
registerSingleton(UserService, [DatabaseService, LoggerService]);
registerSingleton("IUserService", UserService, ["IDatabase", "ILogger"]);
```

- **Rejected**: No type guidance for different registration patterns
- **Rejected**: Unclear parameter ordering for complex registrations
- **Rejected**: Difficult to extend with new options

#### Configuration Object API

```typescript
// Rejected approach
builder.addSingleton({
  key: UserService,
  dependencies: [DatabaseService, LoggerService],
});

builder.addSingleton({
  name: "IUserService",
  type: UserService,
  dependencies: ["IDatabase", "ILogger"],
});
```

- **Rejected**: Verbose object syntax
- **Rejected**: No compile-time validation of object structure
- **Rejected**: Poor discoverability of available options

#### Single Builder Type

```typescript
// Rejected approach
builder.addSingleton((r) =>
  r
    .register(UserService)
    .withType(UserService) // redundant
    .withDependencies(DatabaseService)
);
```

- **Rejected**: Forces redundant method calls
- **Rejected**: Cannot specialize available methods per context
- **Rejected**: Confusing API with unnecessary options

## Implementation Pattern

### Type-Based Registration

```typescript
// Simple service with no dependencies
builder.addSingleton((r) => r.fromType(SimpleService));

// Service with dependencies
builder.addSingleton((r) =>
  r.fromType(UserService).withDependencies(DatabaseService, LoggerService)
);
```

### Interface-Based Registration

```typescript
// Interface with concrete implementation
builder.addSingleton((r) =>
  r
    .fromName("IEmailService")
    .useType(SMTPEmailService)
    .withDependencies("ILogger")
);
```

### Factory-Based Registration

```typescript
// Complex initialization logic
builder.addSingleton((r) =>
  r.fromName("DatabaseConnection").useFactory(async (provider) => {
    const config = provider.get<Config>("Config");
    const connection = await createConnection(config.connectionString);
    return connection;
  })
);
```

## Consequences

### Positive

- **Excellent DX**: Intuitive, type-safe registration experience
- **Self-Documenting**: Code clearly expresses registration intent
- **Maintainable**: Easy to understand and modify registrations
- **Extensible**: Can add new builder methods without breaking changes

### Negative

- **Bundle Size**: Additional classes increase library footprint
- **Complexity**: More moving parts than simple function approach
- **Learning**: Developers must understand fluent builder pattern

## Guidelines

### Registration Best Practices

1. **Use `fromType()` for concrete classes** - maximizes type safety
2. **Use `fromName()` for interfaces** - enables abstraction
3. **Use factories sparingly** - only for complex initialization
4. **Keep dependency lists short** - consider service aggregation

### API Evolution

- New builder methods should follow existing naming patterns
- Breaking changes should be avoided in builder interfaces
- Consider optional parameters before adding new methods

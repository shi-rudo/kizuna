# ADR-010: Type-Safe API Design

## Status

Accepted

## Context

Kizuna needed to provide better developer experience with compile-time type safety, IDE autocompletion, and reduced boilerplate for common dependency injection scenarios. The existing fluent API, while highly flexible, required manual type annotations and provided no compile-time validation for service keys.

Two approaches were considered:

1. **Enhance Fluent API**: Add type inference and validation to the existing callback-based API
2. **Alternative Type-Safe API**: Create a parallel API optimized for type safety and developer experience
3. **Replace Fluent API**: Completely replace the existing API with a type-safe version

## Decision

We chose to create an **Alternative Type-Safe API** alongside the existing fluent API, providing both approaches as first-class citizens.

## Rationale

### Type-Safe API Design

```typescript
// Type-safe API with perfect autocompletion
const container = new ContainerBuilder()
  .registerSingleton("Logger", ConsoleLogger)
  .registerSingleton("Database", DatabaseConnection, "Logger")
  .registerScoped("UserService", UserService, "Database", "Logger")
  .buildTypeSafe();

// IDE provides autocompletion for registered keys: 'Logger', 'Database', 'UserService'
const userService = container.get("UserService"); // Type: UserService (inferred!)
```

### Benefits of Type-Safe API

#### 1. **Compile-Time Type Safety**

```typescript
// Fluent API - Runtime errors
const container = builder.build();
const service = container.get<UserService>("NonExistentService"); // ❌ Runtime error

// Type-Safe API - Compile-time errors
const container = builder.buildTypeSafe();
const service = container.get("NonExistentService"); // ❌ TypeScript error!
```

- Service keys are validated at compile time
- Unregistered services cause TypeScript errors
- No risk of runtime service resolution failures

#### 2. **Perfect IDE Integration**

```typescript
// IDE autocompletion suggests only registered service keys
const container = new ContainerBuilder()
  .registerSingleton("UserRepo", UserRepository)
  .registerSingleton("OrderRepo", OrderRepository)
  .buildTypeSafe();

const repo = container.get(""); // IDE suggests: 'UserRepo', 'OrderRepo'
```

- String literal types provide perfect autocompletion
- IntelliSense shows available service keys
- No need to remember service names

#### 3. **Reduced Boilerplate**

```typescript
// Fluent API - verbose but flexible configuration
builder.addSingleton((r) =>
  r.fromType(UserService).withDependencies(UserRepository, Logger)
);

// Type-Safe API - concise registration
builder.registerSingleton("UserService", UserService, "UserRepo", "Logger");
```

- Direct constructor registration without callbacks
- Dependencies as simple string parameters
- Fluent chaining for multiple registrations

#### 4. **Type Inference Across Scopes**

```typescript
const container = builder.buildTypeSafe();
const scope1 = container.startScope();
const scope2 = container.startScope();

// All service keys are typed consistently across scopes
const service1 = scope1.get("UserService"); // Type: UserService
const service2 = scope2.get("UserService"); // Type: UserService
```

- Type safety maintained across scope boundaries
- No type information loss in scoped containers
- Consistent developer experience

### Implementation Architecture

#### Registry Type Tracking

```typescript
type ServiceRegistry = Record<string, any>;

class ContainerBuilder<TRegistry extends ServiceRegistry = {}> {
  registerSingleton<K extends string, T>(
    key: K,
    serviceType: new (...args: any[]) => T,
    ...dependencies: string[]
  ): ContainerBuilder<TRegistry & Record<K, T>>;
}
```

#### Type-Safe Service Locator

```typescript
interface TypeSafeServiceLocator<TRegistry extends Record<string, any>> {
  get<K extends keyof TRegistry>(key: K): TRegistry[K];
  startScope(): TypeSafeServiceLocator<TRegistry>;
}
```

#### Internal Type-Safe Registrar

```typescript
interface TypeSafeRegistrar<T> {
  useType<TCtor extends new (...args: any[]) => T>(
    constructor: TCtor,
    ...dependencies: string[]
  ): void;
}
```

### Trade-offs Accepted

#### Advantages

- **Developer Productivity**: Massive improvement in IDE experience
- **Error Prevention**: Compile-time validation prevents runtime errors
- **Discoverability**: Autocompletion reveals available services
- **Type Inference**: Full type information without manual annotations
- **Consistency**: Uniform API across containers and scopes

#### Disadvantages

- **API Duplication**: Two APIs to maintain and document
- **Learning Curve**: Developers must understand when to use which API
- **Limited Flexibility**: Constructor-focused, less factory customization
- **Complex Types**: Advanced TypeScript features may confuse some developers
- **Bundle Size**: Additional type machinery increases compilation complexity

### Alternatives Considered

#### Enhance Fluent API Only

```typescript
// Rejected approach - enhancing existing API
builder.addSingleton<UserService>(
  (r) => r.fromType(UserService).withDependencies(DatabaseService) // Type-safe dependencies
);
```

- **Rejected**: Would break backward compatibility
- **Rejected**: Complex type inference through callback chains
- **Rejected**: Still verbose compared to direct registration

#### Replace Fluent API Entirely

```typescript
// Rejected approach - single type-safe API
const container = new ContainerBuilder()
  .register("UserService", UserService, "Database")
  .buildTypeSafe();
```

- **Rejected**: Loss of flexibility for complex scenarios
- **Rejected**: Breaking change for existing users
- **Rejected**: Advanced patterns would be more difficult to implement

#### Generic Key System

```typescript
// Rejected approach - generic keys
const USER_SERVICE = Symbol.for("UserService");
builder.register(USER_SERVICE, UserService);
```

- **Rejected**: Loss of string-based discoverability
- **Rejected**: More complex than string keys
- **Rejected**: No advantage over string literal types

## Implementation Pattern

### Basic Type-Safe Registration

```typescript
const container = new ContainerBuilder()
  .registerSingleton("Config", ConfigService)
  .registerSingleton("Logger", LoggerService, "Config")
  .registerScoped("UserService", UserService, "Logger")
  .buildTypeSafe();
```

### Type-Safe Resolution

```typescript
// Perfect type inference
const config = container.get("Config"); // Type: ConfigService
const logger = container.get("Logger"); // Type: LoggerService
const userService = container.get("UserService"); // Type: UserService

// Compile-time error prevention
const invalid = container.get("NonExistent"); // ❌ TypeScript Error!
```

### Advanced Type Safety

```typescript
// Type safety across complex scenarios
const container = new ContainerBuilder()
  .registerSingleton("DB", DatabaseConnection)
  .registerScoped("UserRepo", UserRepository, "DB")
  .registerScoped("OrderRepo", OrderRepository, "DB")
  .registerTransient("EmailService", EmailService)
  .buildTypeSafe();

// Scoped type safety
const scope = container.startScope();
const userRepo = scope.get("UserRepo"); // Type: UserRepository
const orderRepo = scope.get("OrderRepo"); // Type: OrderRepository

// Constructor-based resolution also works
const emailService = scope.get(EmailService); // Type: EmailService
```

## Consequences

### Positive

- **Exceptional Developer Experience**: IDE autocompletion and type checking
- **Error Prevention**: Compile-time validation prevents runtime issues
- **Reduced Debugging**: Type errors caught during development
- **Team Productivity**: Faster development with better tooling support
- **Maintainability**: Easier refactoring with type safety

### Negative

- **API Surface**: Two APIs to learn, maintain, and document
- **TypeScript Dependency**: Requires advanced TypeScript features
- **Complexity**: More complex implementation than fluent API
- **Limited Flexibility**: Less customization than callback-based approach

## Guidelines

### When to Use Type-Safe API

#### Recommended Scenarios

- **New projects** starting with TypeScript
- **Simple to moderate complexity** dependency graphs
- **Team environments** where IDE productivity is valued
- **Applications prioritizing compile-time safety**
- **Constructor-based service registration**

#### Avoid Type-Safe API When

- **Complex factory functions** with conditional logic required
- **Interface-based registration** patterns needed
- **Dynamic service registration** based on runtime conditions
- **Backward compatibility** with existing fluent API code required

### Migration Strategy

1. **New services**: Use type-safe API for new registrations
2. **Gradual adoption**: Convert simple services first
3. **Complex scenarios**: Keep fluent API for factories and interfaces
4. **Testing**: Both APIs can coexist in the same application

### Best Practices

1. **Use meaningful service keys**: Choose descriptive string identifiers
2. **Group related services**: Register related services together
3. **Document dependencies**: Use consistent naming for service keys
4. **Type imports**: Import types only when needed for better performance

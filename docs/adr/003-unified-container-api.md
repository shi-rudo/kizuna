# ADR-003: Unified Container API

## Status

Accepted

## Context

Kizuna initially explored different API approaches for dependency injection, including separate fluent and type-safe patterns. However, practical experience revealed that users needed the benefits of both patterns in a single, cohesive API. The dual-API approach created several challenges:

1. **API Fragmentation**: Users had to choose between two different APIs for different scenarios
2. **Learning Curve**: Teams needed to understand when to use which API
3. **Inconsistent Patterns**: Different projects adopted different APIs, leading to inconsistency
4. **Maintenance Overhead**: Maintaining two parallel APIs increased complexity
5. **Feature Gaps**: Some capabilities were only available in one API or the other

Based on user feedback and real-world usage patterns, we needed to evolve toward a unified API that combines the strengths of both approaches.

## Decision

We chose to create a **Unified Container API** that integrates both fluent and type-safe patterns into a single `ContainerBuilder` class, providing all registration patterns with full type safety.

## Rationale

### Unified API Design

```typescript
// The ultimate container - all patterns unified with full type safety!
const container = new ContainerBuilder()
  // Constructor-based registration (concise, type-safe)
  .registerSingleton('Logger', ConsoleLogger)
  .registerScoped('UserService', UserService, 'Database', 'Logger')
  
  // Interface-based registration (abstraction + type safety)
  .registerInterface<IDatabase>('Database', PostgreSQLDatabase, 'Logger')
  .registerScopedInterface<ICache>('Cache', RedisCache, 'Logger')
  
  // Factory-based registration (flexibility + type safety)
  .registerFactory('Config', (provider) => {
    const logger = provider.get('Logger'); // Type: ConsoleLogger ✅
    return createConfiguration(logger);
  })
  
  .build(); // Returns TypeSafeServiceLocator with full type inference

// Perfect IDE autocompletion and compile-time type safety
const userService = container.get('UserService'); // Type: UserService ✅
const database = container.get('Database');       // Type: IDatabase ✅
const config = container.get('Config');           // Type: inferred from factory ✅
```

### Benefits of Unified API

#### 1. **Single Learning Model**

```typescript
// One API to learn, with consistent patterns
const container = new ContainerBuilder()
  
  // All registration methods follow the same pattern:
  // .register[Lifecycle][Pattern](key, implementation, ...dependencies)
  
  .registerSingleton('Service1', Service1Class)                    // Constructor
  .registerInterface<IService>('Service2', Service2Impl)          // Interface  
  .registerFactory('Service3', (provider) => new Service3())      // Factory
  
  // Lifecycle variants work identically across all patterns
  .registerScopedInterface<ICache>('Cache', CacheImpl)
  .registerTransientFactory('RequestId', () => crypto.randomUUID())
  
  .build();
```

#### 2. **Full Type Safety Across All Patterns**

```typescript
// Every registration pattern provides complete type safety
const container = new ContainerBuilder()
  .registerSingleton('Logger', ConsoleLogger)
  .registerInterface<IDatabase>('DB', DatabaseService, 'Logger')
  .registerFactory('UserRepo', (provider) => {
    // provider.get() is fully typed based on previous registrations
    const db = provider.get('DB');         // Type: IDatabase ✅
    const logger = provider.get('Logger'); // Type: ConsoleLogger ✅
    return new UserRepository(db, logger);
  })
  .build();

// Resolution is type-safe regardless of registration pattern
const logger = container.get('Logger');   // Type: ConsoleLogger
const db = container.get('DB');           // Type: IDatabase
const repo = container.get('UserRepo');   // Type: UserRepository (inferred!)
```

#### 3. **Comprehensive Registration Capabilities**

```typescript
// Every pattern supports all lifecycles
const container = new ContainerBuilder()
  
  // Singleton services (shared across entire container)
  .registerSingleton('Config', ConfigService)
  .registerInterface<ILogger>('Logger', ConsoleLogger)
  .registerFactory('Database', (provider) => createConnection())
  
  // Scoped services (shared within scope, new per scope)
  .registerScoped('RequestContext', RequestContext)
  .registerScopedInterface<ICache>('Cache', MemoryCache, 'Logger')
  .registerScopedFactory('UserId', () => generateUserId())
  
  // Transient services (new instance every time)
  .registerTransient('EmailService', EmailService, 'Logger')
  .registerTransientInterface<IValidator>('Validator', DefaultValidator)
  .registerTransientFactory('Timestamp', () => Date.now())
  
  .build();
```

#### 4. **Advanced Function Registration Support**

```typescript
// Comprehensive support for functions as services
const container = new ContainerBuilder()
  
  // Functions returning primitives
  .registerFactory('MaxRetries', () => 3)
  .registerFactory('Environment', () => process.env.NODE_ENV || 'development')
  
  // Functions returning collections
  .registerFactory('SupportedLanguages', () => ['en', 'es', 'fr', 'de'])
  .registerFactory('FeatureFlags', () => new Map([['analytics', true]]))
  
  // Functions returning functions (higher-order)
  .registerFactory('Validator', () => ({
    email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    required: (value: any) => value != null && value !== ''
  }))
  
  // Functions returning event systems
  .registerFactory('EventBus', () => {
    const listeners = new Map<string, Function[]>();
    return {
      on: (event: string, callback: Function) => { /* ... */ },
      emit: (event: string, ...args: any[]) => { /* ... */ }
    };
  })
  
  .build();
```

#### 5. **Perfect IDE Integration**

```typescript
const container = new ContainerBuilder()
  .registerSingleton('UserService', UserService)
  .registerInterface<IEmailService>('EmailService', SMTPService)
  .registerFactory('Config', () => ({ env: 'prod' }))
  .build();

// IDE provides autocompletion for ALL registered services
const service = container.get(''); // Suggests: 'UserService', 'EmailService', 'Config'

// Type inference works perfectly for all registration patterns
const userSvc = container.get('UserService');  // Type: UserService
const emailSvc = container.get('EmailService'); // Type: IEmailService  
const config = container.get('Config');         // Type: { env: string }
```

### Implementation Architecture

#### Unified ContainerBuilder Class

```typescript
export class ContainerBuilder<TRegistry extends ServiceRegistry = {}> 
  extends BaseContainerBuilder {
  
  // Constructor-based registration
  registerSingleton<K extends string, T>(
    key: K,
    serviceType: new (...args: any[]) => T,
    ...dependencies: string[]
  ): ContainerBuilder<TRegistry & Record<K, T>>;
  
  // Interface-based registration
  registerInterface<T, K extends string = string>(
    key: K,
    implementationType: new (...args: any[]) => T,
    ...dependencies: string[]
  ): ContainerBuilder<TRegistry & Record<K, T>>;
  
  // Factory-based registration
  registerFactory<K extends string, T>(
    key: K,
    factory: (provider: TypeSafeServiceLocator<TRegistry>) => T
  ): ContainerBuilder<TRegistry & Record<K, T>>;
  
  // All patterns support all lifecycles
  registerScoped<K extends string, T>(...): ContainerBuilder<TRegistry & Record<K, T>>;
  registerTransient<K extends string, T>(...): ContainerBuilder<TRegistry & Record<K, T>>;
  registerScopedInterface<T, K extends string>(...): ContainerBuilder<TRegistry & Record<K, T>>;
  registerTransientInterface<T, K extends string>(...): ContainerBuilder<TRegistry & Record<K, T>>;
  registerScopedFactory<K extends string, T>(...): ContainerBuilder<TRegistry & Record<K, T>>;
  registerTransientFactory<K extends string, T>(...): ContainerBuilder<TRegistry & Record<K, T>>;
  
  // Build with full type safety
  build(): TypeSafeServiceLocator<TRegistry>;
}
```

#### Type-Safe Provider System

```typescript
// Factory functions receive fully typed providers
.registerFactory('ComplexService', (provider) => {
  // Every .get() call is fully typed based on registry
  const logger = provider.get('Logger');     // Type inferred from registry
  const database = provider.get('Database'); // Type inferred from registry
  const config = provider.get('Config');     // Type inferred from registry
  
  return new ComplexService(logger, database, config);
});
```

#### Registry Type Tracking

```typescript
// Progressive type building as services are registered
type EmptyRegistry = {};
type WithLogger = EmptyRegistry & Record<'Logger', ConsoleLogger>;
type WithDatabase = WithLogger & Record<'Database', IDatabase>;
type WithUserService = WithDatabase & Record<'UserService', UserService>;

// TypeScript tracks the complete service registry through the fluent chain
```

### Trade-offs Accepted

#### Advantages

- **Unified Learning**: Single API reduces cognitive overhead
- **Complete Type Safety**: All patterns provide full compile-time validation
- **Feature Parity**: All registration patterns support all lifecycles
- **Better DX**: Perfect IDE integration across all scenarios
- **Maintainability**: Single API surface to maintain and document
- **Flexibility**: Can mix and match patterns as needed in single container
- **Future-Proof**: Easy to add new registration patterns without API fragmentation

#### Disadvantages

- **API Complexity**: Single class has many methods (mitigated by clear patterns)
- **Learning Curve**: Comprehensive API has many methods to learn initially
- **Bundle Size**: Comprehensive API increases library size
- **Type Complexity**: Advanced TypeScript features may confuse beginners


### Validation and Error Handling

#### Comprehensive Validation Support

```typescript
const builder = new ContainerBuilder()
  .registerSingleton('Service1', Service1, 'MissingDep') // Missing dependency
  .registerFactory('Service2', (provider) => {
    throw new Error('Factory error');
  });

// Validation catches issues before runtime
const validationIssues = builder.validate();
// Returns: ["Service1 depends on unregistered service 'MissingDep'"]
```

#### Type-Safe Error Prevention

```typescript
const container = new ContainerBuilder()
  .registerSingleton('Logger', ConsoleLogger)
  .build();

// Compile-time error for non-existent service
const service = container.get('NonExistent'); // ❌ TypeScript Error!

// Runtime error prevention through validation
const builder = new ContainerBuilder()
  .registerSingleton('Service', ServiceClass, 'MissingDep');

builder.validate(); // Catches missing dependency before build
```

## Consequences

### Positive

- **Developer Experience**: Single, comprehensive API with perfect type safety
- **Reduced Complexity**: No need to choose between multiple APIs
- **Feature Complete**: All patterns support all lifecycles and validation
- **IDE Excellence**: Perfect autocompletion and error detection
- **Maintainable**: Single API surface reduces maintenance overhead
- **Extensible**: Easy to add new patterns without fragmenting the API
- **Type Safety**: Compile-time validation prevents runtime errors
- **Performance**: No runtime overhead for type safety features

### Negative

- **API Surface**: Large number of methods in single class
- **Learning Curve**: Initial complexity for comprehensive API
- **Bundle Size**: More complete API increases library footprint
- **TypeScript Dependency**: Requires advanced TypeScript features

## Implementation Guidelines

### Registration Patterns

#### Use Constructor Registration When
- Registering concrete classes with constructor dependencies
- Dependencies can be satisfied by other registered services
- Simple, straightforward service instantiation

```typescript
.registerSingleton('UserService', UserService, 'Database', 'Logger')
```

#### Use Interface Registration When
- Abstracting behind interfaces
- Supporting multiple implementations
- Enabling testing with mocks

```typescript
.registerInterface<IEmailService>('EmailService', SMTPEmailService, 'Config')
```

#### Use Factory Registration When
- Complex initialization logic required
- Conditional service creation
- Runtime configuration needed
- Creating primitive values, functions, or collections

```typescript
.registerFactory('DatabaseConnection', async (provider) => {
  const config = provider.get('Config');
  return await createConnection(config.connectionString);
})
```

### Lifecycle Selection

- **Singleton**: Shared across entire application (configs, loggers, databases)
- **Scoped**: Shared within request/operation scope (request context, user sessions)
- **Transient**: New instance every time (commands, value objects, timestamps)

### Best Practices

1. **Consistent Naming**: Use meaningful, descriptive service keys
2. **Dependency Order**: Register dependencies before dependent services
3. **Interface Abstraction**: Prefer interfaces for services with multiple implementations
4. **Factory Sparingly**: Use factories only when constructor registration isn't sufficient
5. **Validation Always**: Call `validate()` before `build()` in development
6. **Scoped Cleanup**: Always dispose scoped containers when done

## Future Evolution

### Planned Enhancements

- **Generic Factory Types**: Better type inference for complex factory scenarios
- **Service Decorators**: TypeScript decorator support for class-based registration
- **Module System**: Higher-level abstractions for organizing related services
- **Async Factories**: First-class support for promise-returning factories
- **Configuration Providers**: Integration with configuration systems

This unified API represents Kizuna's comprehensive dependency injection capabilities, providing a single, powerful, and type-safe container system that supports all registration patterns with excellent developer experience.
# ADR-007: Fail-Fast Error Handling

## Status

Accepted

## Context

Kizuna needed to establish an error handling philosophy for the dependency injection framework. Two primary approaches were considered:

1. **Lenient Error Handling**: Allow invalid configurations and attempt runtime recovery
2. **Fail-Fast Error Handling**: Extensive validation with immediate failure on invalid input
3. **Deferred Validation**: Defer validation until service resolution time

## Decision

We chose the **Fail-Fast Error Handling** approach with extensive parameter validation and immediate throwing of descriptive error messages.

## Rationale

### Fail-Fast Implementation

```typescript
// Extensive validation in builder methods
fromType<T>(type: Constructor<T>): TypeServiceBuilder<T> {
  if (!type) {
    throw new Error("Type cannot be null or undefined");
  }

  if (typeof type !== "function") {
    throw new Error("Type must be a constructor function");
  }

  return new TypeServiceBuilder(type);
}

// Immediate validation in service wrapper creation
constructor(
  name: string,
  type: Constructor<T> | null,
  dependencies: ServiceKey<any>[]
) {
  if (!name || name.trim() === "") {
    throw new Error("Service name cannot be empty");
  }

  if (!dependencies) {
    throw new Error("Dependencies array cannot be null");
  }

  this._name = name;
  this._type = type;
  this.dependencies = Object.freeze([...dependencies]);
}
```

### Benefits of Fail-Fast Approach

#### 1. **Early Problem Detection**

```typescript
// Validation happens at registration time, not resolution time
builder.addSingleton(
  (r) => r.fromType(null) // Throws immediately: "Type cannot be null or undefined"
);

// vs runtime discovery:
const service = container.get(InvalidService); // Would fail much later
```

- Configuration errors discovered during application setup
- No surprise failures during request processing
- Clear error boundaries between configuration and runtime phases

#### 2. **Descriptive Error Messages**

```typescript
// Clear, actionable error messages
throw new Error(`No service registered for key: ${typeName}`);
throw new Error(
  `Failed to resolve service ${typeName}: circular dependency detected`
);
throw new Error("Service name cannot be empty");
throw new Error("Factory function cannot be null or undefined");
```

- Developers can immediately understand what went wrong
- Error messages include context about the specific problem
- No generic "something failed" errors

#### 3. **Development-Time Safety**

```typescript
// Catches common mistakes immediately
builder.addSingleton((r) =>
  r
    .fromName("") // Throws: "Service name cannot be empty"
    .useType(UserService)
);

builder.addSingleton(
  (r) => r.fromType(UserService).withDependencies(null) // Throws: "Dependencies array cannot be null"
);
```

- IDE and build tools catch configuration errors early
- Prevents deployment of misconfigured applications
- Reduces debugging time in development

#### 4. **Consistent Error Handling Patterns**

```typescript
// Consistent validation pattern across all builders
class TypeServiceBuilder<T> {
  withDependencies<TDeps extends ServiceKey<any>[]>(
    ...dependencies: TDeps
  ): ServiceWrapper<T> {
    if (!dependencies) {
      throw new Error("Dependencies cannot be null");
    }

    for (const dep of dependencies) {
      if (!dep) {
        throw new Error("Dependency cannot be null or undefined");
      }
    }

    return new ServiceWrapper(this._type.name, this._type, dependencies);
  }
}
```

- Predictable error behavior across all API surfaces
- No inconsistent validation between different registration methods
- Clear contract about when and how validation occurs

### Implementation Details

#### Input Validation Strategy

```typescript
// Validate all inputs at method entry points
fromName<T>(name: string): NamedServiceBuilder<T> {
  validateServiceName(name);
  return new NamedServiceBuilder<T>(name);
}

useType<U extends T>(type: Constructor<U>): FactoryServiceBuilder<T> {
  validateConstructor(type);
  return new FactoryServiceBuilder(this._name, type, []);
}

useFactory(factory: Factory<T>): FactoryServiceBuilder<T> {
  validateFactory(factory);
  return new FactoryServiceBuilder(this._name, null, [], factory);
}
```

#### Resolution-Time Error Handling

```typescript
get<T>(key: ServiceKey<T>): T {
  const typeName = this.getTypeName(key);
  const resolver = this.registrations[typeName];

  if (!resolver) {
    throw new Error(`No service registered for key: ${typeName}`);
  }

  try {
    return resolver.resolve(this) as T;
  } catch (error) {
    throw new Error(
      `Failed to resolve service ${typeName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

#### Circular Dependency Detection

```typescript
validate(): void {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  for (const serviceName of Object.keys(this._registrations)) {
    if (this.hasCircularDependency(serviceName, visited, recursionStack)) {
      throw new Error(`Circular dependency detected involving service: ${serviceName}`);
    }
  }
}
```

### Trade-offs Accepted

#### Advantages

- **Reliability**: Configuration errors caught at build/startup time
- **Developer Experience**: Clear, actionable error messages
- **Debugging**: Easy to trace configuration problems
- **Consistency**: Predictable error behavior across all APIs
- **Safety**: Prevents runtime failures in production

#### Disadvantages

- **Performance**: Validation overhead at registration time
- **Strictness**: May reject edge cases that could theoretically work
- **Verbosity**: More validation code to write and maintain
- **Learning Curve**: Developers must understand validation rules

### Alternatives Considered

#### Lenient Error Handling

```typescript
// Rejected approach
fromType<T>(type: Constructor<T>): TypeServiceBuilder<T> {
  // Accept any input, try to make it work
  if (!type) {
    console.warn("Type is null, will attempt runtime resolution");
  }

  return new TypeServiceBuilder(type || Object as Constructor<T>);
}
```

- **Rejected**: Unpredictable behavior when invalid inputs are provided
- **Rejected**: Errors surface at runtime instead of configuration time
- **Rejected**: Difficult to debug when things go wrong

#### Deferred Validation

```typescript
// Rejected approach
class ServiceWrapper<T> {
  constructor(
    name: string,
    type: Constructor<T>,
    dependencies: ServiceKey<any>[]
  ) {
    // Store without validation
    this._name = name;
    this._type = type;
    this.dependencies = dependencies;
  }

  validate(): void {
    // Validate only when explicitly called
    if (!this._name) throw new Error("Name required");
  }
}
```

- **Rejected**: Optional validation means errors may go undetected
- **Rejected**: Unclear when validation should be performed
- **Rejected**: Separation between configuration and validation creates complexity

#### Silent Failure with Defaults

```typescript
// Rejected approach
fromName<T>(name: string): NamedServiceBuilder<T> {
  const safeName = name || `generated_${Math.random()}`;
  return new NamedServiceBuilder<T>(safeName);
}
```

- **Rejected**: Hides configuration problems from developers
- **Rejected**: Generated defaults may not match developer intent
- **Rejected**: Makes debugging much more difficult

## Implementation Pattern

### Registration-Time Validation

```typescript
// All builder methods validate immediately
builder.addSingleton(
  (r) =>
    r
      .fromType(UserService) // Validates constructor
      .withDependencies(Database) // Validates dependencies
);

// Invalid configuration fails fast
try {
  builder.addSingleton((r) => r.fromType(null));
} catch (error) {
  console.error("Configuration error:", error.message);
  // "Type cannot be null or undefined"
}
```

### Resolution-Time Error Wrapping

```typescript
// Resolution errors include context
try {
  const service = container.get("MissingService");
} catch (error) {
  console.error(error.message);
  // "No service registered for key: MissingService"
}

try {
  const service = container.get("FailingService");
} catch (error) {
  console.error(error.message);
  // "Failed to resolve service FailingService: Database connection failed"
}
```

### Validation Helper Functions

```typescript
function validateServiceName(name: string): void {
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new Error("Service name must be a non-empty string");
  }
}

function validateConstructor<T>(type: Constructor<T>): void {
  if (!type || typeof type !== "function") {
    throw new Error("Type must be a constructor function");
  }
}

function validateFactory<T>(factory: Factory<T>): void {
  if (!factory || typeof factory !== "function") {
    throw new Error("Factory must be a function");
  }
}
```

## Consequences

### Positive

- **Early Detection**: Configuration errors found during setup
- **Clear Messages**: Descriptive errors help developers fix problems quickly
- **Reliability**: Prevents invalid configurations from reaching production
- **Consistency**: Uniform error handling across all API surfaces

### Negative

- **Performance**: Validation overhead during registration
- **Strictness**: May reject configurations that could theoretically work
- **Code Volume**: Additional validation logic throughout codebase

## Guidelines

### Error Message Best Practices

1. **Be Specific**: Include the invalid value and expected format
2. **Be Actionable**: Tell the developer what to fix
3. **Include Context**: Mention which service or registration is problematic
4. **Avoid Jargon**: Use clear, plain language

### Validation Strategy

1. **Validate Early**: Check inputs at method entry points
2. **Fail Fast**: Don't attempt recovery from invalid configurations
3. **Wrap Errors**: Add context when re-throwing errors
4. **Test Error Paths**: Ensure error messages are helpful

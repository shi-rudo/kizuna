# ADR-002: Dual Service Key Strategy

## Status

Accepted

## Context

Kizuna needs to support service registration and resolution that accommodates both TypeScript interfaces and concrete classes. Two primary approaches were considered:

1. **String-Only Keys**: Services registered with string identifiers only
2. **Constructor-Only Keys**: Services registered with constructor functions only
3. **Dual Key Strategy**: Support both string and constructor-based keys

## Decision

We chose the **Dual Service Key Strategy** supporting both string and constructor-based service keys.

## Rationale

### Type Definition

```typescript
type ServiceKey<T> = string | Constructor<T>;
type Constructor<T> = new (...args: any[]) => T;
```

### Benefits of Dual Approach

#### 1. **Interface Support via String Keys**

```typescript
// Enable interface-based registration
interface IUserService {
  getUser(id: string): User;
}

builder.addSingleton((r) =>
  r.fromName("IUserService").useType(UserService).withDependencies("IDatabase")
);
```

- Enables dependency injection against interfaces/contracts
- Supports multiple implementations of same interface
- Facilitates testing with mock implementations

#### 2. **Type Safety via Constructor Keys**

```typescript
// Compile-time type checking
builder.addSingleton((r) =>
  r.fromType(UserService).withDependencies(DatabaseService)
);

// Type-safe resolution
const userService = container.get(UserService); // Returns UserService
```

- Full TypeScript intellisense and compile-time checking
- Impossible to register wrong types
- Refactoring safety (renames propagate automatically)

#### 3. **Flexible Registration Patterns**

```typescript
// Interface-based architecture
builder.addSingleton((r) => r.fromName("ILogger").useType(ConsoleLogger));
builder.addSingleton((r) => r.fromName("ILogger").useType(FileLogger)); // Different environments

// Class-based convenience
builder.addSingleton((r) =>
  r.fromType(UserService).withDependencies(DatabaseService)
);
```

### Implementation Details

#### Service Provider Resolution

```typescript
private getTypeName<T>(key: ServiceKey<T>): string {
  return typeof key === "string" ? key : key.name;
}

get<T>(key: ServiceKey<T>): T {
  const typeName = this.getTypeName(key);
  const resolver = this.registrations[typeName];
  // ...
}
```

#### Builder API Support

```typescript
// String-based registration
fromName(name: string): NamedServiceBuilder<T>

// Constructor-based registration
fromType<U>(type: Constructor<U>): TypeServiceBuilder<U>
```

### Trade-offs Accepted

#### Advantages

- **Maximum Flexibility**: Supports both interface and concrete class patterns
- **Gradual Adoption**: Teams can start with constructors, move to interfaces
- **Testing Friendly**: Easy to mock interfaces while maintaining type safety for concrete classes
- **Framework Agnostic**: Works with any TypeScript architectural pattern

#### Disadvantages

- **API Complexity**: Two registration paths to learn and maintain
- **Runtime String Keys**: String-based keys lose compile-time safety
- **Potential Confusion**: Developers might not know which approach to use
- **Duplicate Registrations**: Same service could be registered under both string and constructor

### Alternatives Considered

#### Constructor-Only Approach

```typescript
// Rejected: Cannot represent interfaces
type ServiceKey<T> = Constructor<T>;
```

- **Rejected**: Eliminates interface-based dependency injection
- **Rejected**: Forces concrete dependencies everywhere
- **Rejected**: Makes testing more difficult

#### String-Only Approach

```typescript
// Rejected: Loses all type safety
type ServiceKey<T> = string;
```

- **Rejected**: No compile-time type checking
- **Rejected**: Vulnerable to runtime typos
- **Rejected**: Poor refactoring experience

#### Separate Container Types

```typescript
// Rejected: API fragmentation
class TypedContainer {
  /* constructor keys only */
}
class StringContainer {
  /* string keys only */
}
```

- **Rejected**: Fragments the API into multiple types
- **Rejected**: Cannot mix registration strategies in same container
- **Rejected**: Complicates documentation and learning

## Implementation Pattern

### Interface-Based Architecture

```typescript
interface IEmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

interface IUserService {
  createUser(email: string): Promise<User>;
}

// Registration
builder.addSingleton((r) =>
  r.fromName("IEmailService").useType(SMTPEmailService)
);
builder.addSingleton((r) =>
  r
    .fromName("IUserService")
    .useType(UserService)
    .withDependencies("IEmailService")
);

// Resolution
const userService = container.get<IUserService>("IUserService");
```

### Class-Based Convenience

```typescript
class DatabaseService {
  connect(): void {
    /* ... */
  }
}

class UserService {
  constructor(private db: DatabaseService) {}
}

// Registration
builder.addSingleton((r) => r.fromType(DatabaseService));
builder.addSingleton((r) =>
  r.fromType(UserService).withDependencies(DatabaseService)
);

// Resolution
const userService = container.get(UserService); // Fully typed
```

## Consequences

### Positive

- **Architecture Flexibility**: Supports both interface and class-based designs
- **Type Safety Options**: Choose between compile-time safety and interface flexibility
- **Testing Support**: Easy mocking with interfaces, type safety with classes
- **Migration Path**: Can evolve from class-based to interface-based architecture

### Negative

- **Learning Curve**: Developers must understand when to use each approach
- **API Surface**: Larger API with two registration patterns
- **Documentation Burden**: Must explain both approaches clearly

## Guidelines

### When to Use String Keys

- Registering against interfaces or abstract contracts
- Multiple implementations of the same service
- Testing scenarios with mocks
- Cross-module dependencies where you want loose coupling

### When to Use Constructor Keys

- Simple service registration for concrete classes
- Maximum type safety and intellisense
- Refactoring-safe dependencies
- Internal module dependencies

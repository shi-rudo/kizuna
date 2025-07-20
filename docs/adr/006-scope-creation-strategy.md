# ADR-006: Scope Creation Strategy

## Status

Accepted

## Context

Kizuna needed to implement scoped service resolution, where services can have different instances per scope (e.g., per HTTP request, per transaction). Three primary approaches were considered:

1. **Scope Inheritance**: Child scopes inherit parent scope services
2. **Scope Isolation**: Each scope maintains completely separate service instances
3. **Registration Replication**: Create new containers with cloned service registrations

## Decision

We chose the **Registration Replication** approach where scopes are created by replicating the entire service registration map with new lifecycle instances.

## Rationale

### Scope Creation Implementation

```typescript
startScope(): ServiceProvider {
  const scopedRegistrations: Record<string, Container> = {};

  for (const [key, container] of Object.entries(this.registrations)) {
    if (container instanceof ScopedLifecycle) {
      // Create new scoped lifecycle instance for the scope
      scopedRegistrations[key] = new ScopedLifecycle(
        container._factory,
        container._dependencies
      );
    } else {
      // Singleton and Transient lifecycles are shared
      scopedRegistrations[key] = container;
    }
  }

  return new ServiceProvider(scopedRegistrations);
}
```

### Benefits of Registration Replication

#### 1. **Clear Scope Isolation**

```typescript
const parentProvider = container.build();
const scope1 = parentProvider.startScope();
const scope2 = parentProvider.startScope();

// Each scope has completely independent scoped services
const service1 = scope1.get(ScopedService); // Instance A
const service2 = scope2.get(ScopedService); // Instance B (different)
const parentService = parentProvider.get(ScopedService); // Instance C (different)
```

- No shared state between different scopes
- Clear boundaries for scope lifetime management
- Predictable behavior across scope boundaries

#### 2. **Selective Lifecycle Handling**

```typescript
// Only scoped services get new instances per scope
class ScopedLifecycle implements Container {
  // Each scope gets its own instance of this lifecycle
}

// Singletons remain shared across all scopes
class SingletonLifecycle implements Container {
  // Same instance shared across parent and all scopes
}

// Transients always create new instances
class TransientLifecycle implements Container {
  // No state to scope - behaves identically
}
```

- Singleton behavior preserved across scope boundaries
- Scoped services properly isolated per scope
- Transient services unaffected by scope creation

#### 3. **Memory Efficiency for Shared Services**

```typescript
// Singleton and Transient containers are reused
const sharedSingleton = new SingletonLifecycle(factory, deps);
const sharedTransient = new TransientLifecycle(factory, deps);

// Only scoped lifecycles are replicated
scopedRegistrations["SharedService"] = sharedSingleton; // Reference
scopedRegistrations["ScopedService"] = new ScopedLifecycle(factory, deps); // New instance
```

- No duplication of singleton or transient container instances
- Only scoped lifecycle containers are replicated
- Minimal memory overhead for scope creation

#### 4. **Simple Disposal Model**

```typescript
// Scope disposal is straightforward
scope.dispose(); // Disposes only scoped service instances

// Parent container remains unaffected
parentProvider.get(SingletonService); // Still works
```

- Clear ownership model for scoped instances
- Parent container services unaffected by scope disposal
- No complex reference counting or cleanup logic

### Implementation Details

#### Service Provider Scope Management

```typescript
class ServiceProvider implements ServiceLocator {
  private readonly _scopeId: symbol;

  constructor(
    private readonly registrations: Record<string, Container>,
    scopeId?: symbol
  ) {
    this._scopeId = scopeId || Symbol("root-scope");
  }

  startScope(): ServiceProvider {
    const scopedRegistrations = this.cloneRegistrationsForScope();
    return new ServiceProvider(scopedRegistrations, Symbol("child-scope"));
  }
}
```

#### Scoped Lifecycle Scope Awareness

```typescript
class ScopedLifecycle implements Container {
  private readonly _instances = new Map<symbol, any>();

  resolve(serviceProvider: ServiceLocator): any {
    const scopeId = serviceProvider.getScopeId();

    if (!this._instances.has(scopeId)) {
      const instance = this.createInstance(serviceProvider);
      this._instances.set(scopeId, instance);
    }

    return this._instances.get(scopeId);
  }
}
```

### Trade-offs Accepted

#### Advantages

- **Isolation**: Clear separation between scope instances
- **Predictability**: Consistent behavior across lifecycle types
- **Performance**: Shared singletons, no unnecessary duplication
- **Simplicity**: Straightforward disposal and cleanup model
- **Memory**: Efficient memory usage for shared services

#### Disadvantages

- **Container Overhead**: Each scope creates a new ServiceProvider instance
- **Registration Duplication**: Service registration map is cloned per scope
- **Complexity**: More complex than simple scope inheritance
- **Debugging**: More objects to track during debugging

### Alternatives Considered

#### Scope Inheritance Model

```typescript
// Rejected approach
class ServiceProvider {
  constructor(
    private readonly registrations: Record<string, Container>,
    private readonly parentScope?: ServiceProvider
  ) {}

  get<T>(key: ServiceKey<T>): T {
    if (this.registrations[key]) {
      return this.registrations[key].resolve(this);
    }
    // Fall back to parent scope
    return this.parentScope?.get(key);
  }
}
```

- **Rejected**: Complex resolution chain with parent lookups
- **Rejected**: Unclear behavior when parent scope is disposed
- **Rejected**: Difficult to implement proper disposal semantics

#### Scope Isolation with Service Copying

```typescript
// Rejected approach
startScope(): ServiceProvider {
  const scopedServices: Record<string, any> = {};

  // Copy all scoped service instances to new scope
  for (const [key, container] of Object.entries(this.registrations)) {
    if (container instanceof ScopedLifecycle) {
      const instance = container.resolve(this);
      scopedServices[key] = cloneDeep(instance);
    }
  }

  return new ServiceProvider(this.registrations, scopedServices);
}
```

- **Rejected**: Expensive deep copying of service instances
- **Rejected**: Complex cloning logic for arbitrary service types
- **Rejected**: Breaks object identity and reference equality

#### Global Scope Registry

```typescript
// Rejected approach
class ScopeRegistry {
  private static readonly scopes = new Map<symbol, ServiceProvider>();

  static createScope(): ServiceProvider {
    const scopeId = Symbol();
    const scope = new ServiceProvider(/* ... */, scopeId);
    ScopeRegistry.scopes.set(scopeId, scope);
    return scope;
  }
}
```

- **Rejected**: Global state management complexity
- **Rejected**: Memory leaks if scopes aren't properly cleaned up
- **Rejected**: Difficult to track scope relationships

## Implementation Pattern

### Basic Scope Usage

```typescript
// Create root container
const builder = new ContainerBuilder();
builder.addSingleton((r) => r.fromType(SingletonService));
builder.addScoped((r) => r.fromType(ScopedService));
builder.addTransient((r) => r.fromType(TransientService));

const rootProvider = builder.build();

// Create scoped provider
const scopedProvider = rootProvider.startScope();

// Services behave according to their lifecycle
const singleton1 = rootProvider.get(SingletonService);
const singleton2 = scopedProvider.get(SingletonService);
// singleton1 === singleton2 (same instance)

const scoped1 = rootProvider.get(ScopedService);
const scoped2 = scopedProvider.get(ScopedService);
// scoped1 !== scoped2 (different instances)
```

### Nested Scope Creation

```typescript
const rootProvider = builder.build();
const scope1 = rootProvider.startScope();
const scope2 = scope1.startScope(); // Nested scope

// Each scope maintains independence
const service1 = scope1.get(ScopedService);
const service2 = scope2.get(ScopedService);
// service1 !== service2
```

### Scope Disposal

```typescript
const scope = rootProvider.startScope();
const scopedService = scope.get(ScopedService);

// Clean up scope
scope.dispose(); // Disposes scoped service instances

// Root provider remains functional
const rootService = rootProvider.get(SingletonService); // Still works
```

## Consequences

### Positive

- **Clear Semantics**: Predictable behavior for all lifecycle types
- **Isolation**: Strong boundaries between scope instances
- **Performance**: Efficient sharing of singleton and transient services
- **Disposal**: Simple cleanup model with clear ownership

### Negative

- **Memory**: Additional ServiceProvider instances per scope
- **Complexity**: More complex than simple inheritance models
- **Debugging**: More object instances to track and understand

## Guidelines

### When to Use Scopes

- **Request Processing**: HTTP request-scoped services
- **Transaction Management**: Database transaction-scoped services
- **User Sessions**: User session-scoped caching or state
- **Batch Processing**: Job or batch-scoped resources

### Scope Management Best Practices

1. **Dispose Scopes**: Always dispose scopes when done to free resources
2. **Avoid Long-Lived Scopes**: Don't hold scope references longer than necessary
3. **Scope Service Lifecycle**: Only register truly scope-dependent services as scoped
4. **Testing**: Use scopes to isolate test scenarios

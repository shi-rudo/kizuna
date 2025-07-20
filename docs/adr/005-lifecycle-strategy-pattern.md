# ADR-005: Lifecycle Strategy Pattern

## Status

Accepted

## Context

Kizuna needed to implement different service lifecycles (Singleton, Scoped, Transient) with requirements for:

- Clear separation of lifecycle behaviors
- Extensibility for custom lifecycles
- Consistent interface across all lifecycle types
- Performance optimization per lifecycle type

Three architectural approaches were considered:

1. **Single Lifecycle Class**: One class with conditional logic for all lifecycles
2. **Shared Base Class**: Common base class with lifecycle-specific overrides
3. **Strategy Pattern**: Independent lifecycle implementations sharing a common interface

## Decision

We chose the **Strategy Pattern** with independent lifecycle implementations.

## Rationale

### Strategy Pattern Implementation

```typescript
interface Container {
  resolve(serviceProvider: ServiceLocator): any;
  dispose?(): void;
}

// Independent implementations
class SingletonLifecycle implements Container {
  /* ... */
}
class ScopedLifecycle implements Container {
  /* ... */
}
class TransientLifecycle implements Container {
  /* ... */
}
```

### Benefits of Strategy Pattern

#### 1. **Clear Separation of Concerns**

```typescript
// Each lifecycle focuses solely on its behavior
class SingletonLifecycle implements Container {
  private _instance: any = null;

  resolve(serviceProvider: ServiceLocator): any {
    if (this._instance === null) {
      this._instance = this._factory(serviceProvider);
    }
    return this._instance;
  }
}

class TransientLifecycle implements Container {
  resolve(serviceProvider: ServiceLocator): any {
    // Always create new instance
    return this._factory(serviceProvider);
  }
}
```

- No conditional logic mixing different lifecycle behaviors
- Single responsibility per lifecycle class
- Easy to understand and reason about each lifecycle

#### 2. **Performance Optimization per Lifecycle**

```typescript
// Singleton optimized for single instance
class SingletonLifecycle {
  private _instance: any = null; // Simple null check
}

// Scoped optimized for scope-based instances
class ScopedLifecycle {
  private readonly _instances = new Map<symbol, any>(); // Scope tracking
}

// Transient optimized for no state
class TransientLifecycle {
  // No instance storage - minimal memory footprint
}
```

- Each lifecycle can optimize for its specific use case
- No unused properties or logic for irrelevant scenarios
- Memory usage tailored to lifecycle requirements

#### 3. **Extensibility Without Modification**

```typescript
// Custom lifecycle implementation
class PooledLifecycle implements Container {
  private readonly _pool: any[] = [];
  private readonly _maxPoolSize: number;

  resolve(serviceProvider: ServiceLocator): any {
    return this._pool.pop() || this._factory(serviceProvider);
  }

  dispose(): void {
    this._pool.splice(0); // Clear pool
  }
}

// Registration works seamlessly
const pooledContainer = new PooledLifecycle(factory, [], 10);
```

- New lifecycles can be added without modifying existing code
- Framework users can implement custom lifecycle behaviors
- Open/closed principle adherence

#### 4. **Testability and Isolation**

```typescript
// Test individual lifecycle behavior in isolation
describe("SingletonLifecycle", () => {
  it("should return same instance on multiple calls", () => {
    const lifecycle = new SingletonLifecycle(factory, []);
    const instance1 = lifecycle.resolve(mockProvider);
    const instance2 = lifecycle.resolve(mockProvider);
    expect(instance1).toBe(instance2);
  });
});
```

- Each lifecycle can be unit tested independently
- No complex mocking of conditional logic
- Clear test boundaries and expectations

### Implementation Architecture

#### Common Interface

```typescript
interface Container {
  resolve(serviceProvider: ServiceLocator): any;
  dispose?(): void;
}
```

#### Lifecycle Implementations

```typescript
class SingletonLifecycle implements Container {
  private _instance: any = null;

  constructor(
    private readonly _factory: Factory<any>,
    private readonly _dependencies: readonly ServiceKey<any>[]
  ) {}

  resolve(serviceProvider: ServiceLocator): any {
    if (this._instance === null) {
      const resolvedDependencies = this._dependencies.map((dep) =>
        serviceProvider.get(dep)
      );
      this._instance = this._factory(serviceProvider, ...resolvedDependencies);
    }
    return this._instance;
  }
}

class ScopedLifecycle implements Container {
  private readonly _instances = new Map<symbol, any>();

  resolve(serviceProvider: ServiceLocator): any {
    const scopeId = serviceProvider.getScopeId();

    if (!this._instances.has(scopeId)) {
      const resolvedDependencies = this._dependencies.map((dep) =>
        serviceProvider.get(dep)
      );
      const instance = this._factory(serviceProvider, ...resolvedDependencies);
      this._instances.set(scopeId, instance);
    }

    return this._instances.get(scopeId);
  }

  dispose(): void {
    this._instances.clear();
  }
}

class TransientLifecycle implements Container {
  resolve(serviceProvider: ServiceLocator): any {
    const resolvedDependencies = this._dependencies.map((dep) =>
      serviceProvider.get(dep)
    );
    return this._factory(serviceProvider, ...resolvedDependencies);
  }
}
```

### Trade-offs Accepted

#### Advantages

- **Clarity**: Each lifecycle is easy to understand in isolation
- **Performance**: Optimized implementation per lifecycle type
- **Extensibility**: New lifecycles don't require framework changes
- **Maintainability**: Changes to one lifecycle don't affect others
- **Testability**: Clear boundaries for unit testing

#### Disadvantages

- **Code Duplication**: Similar dependency resolution logic across lifecycles
- **Class Count**: More classes than monolithic approach
- **Coordination**: Ensuring consistent behavior across strategies requires discipline

### Alternatives Considered

#### Single Lifecycle Class with Conditionals

```typescript
// Rejected approach
class Lifecycle {
  resolve(serviceProvider: ServiceLocator): any {
    switch (this._type) {
      case "singleton":
        if (this._instance === null) {
          this._instance = this._factory(serviceProvider);
        }
        return this._instance;
      case "transient":
        return this._factory(serviceProvider);
      case "scoped":
      // Complex scoped logic...
    }
  }
}
```

- **Rejected**: Mixed responsibilities in single class
- **Rejected**: Poor performance due to runtime switching
- **Rejected**: Difficult to extend with custom lifecycles

#### Shared Base Class Hierarchy

```typescript
// Rejected approach
abstract class BaseLifecycle {
  abstract resolve(serviceProvider: ServiceLocator): any;

  protected resolveDependencies(serviceProvider: ServiceLocator): any[] {
    return this._dependencies.map((dep) => serviceProvider.get(dep));
  }
}

class SingletonLifecycle extends BaseLifecycle {
  /* ... */
}
```

- **Rejected**: Creates coupling between lifecycle implementations
- **Rejected**: Changes to base class affect all lifecycles
- **Rejected**: Inheritance complexity for simple behavior differences

#### Functional Approach

```typescript
// Rejected approach
type LifecycleResolver = (
  factory: Factory<any>,
  dependencies: ServiceKey<any>[]
) => (serviceProvider: ServiceLocator) => any;

const singletonResolver: LifecycleResolver = (factory, deps) => {
  let instance: any = null;
  return (provider) => {
    if (instance === null) {
      instance = factory(provider, ...deps.map((d) => provider.get(d)));
    }
    return instance;
  };
};
```

- **Rejected**: Harder to extend with custom behavior (disposal, cleanup)
- **Rejected**: Less discoverable than class-based approach
- **Rejected**: Complex closure management for state

## Implementation Pattern

### Lifecycle Registration

```typescript
class ContainerBuilder {
  addSingleton<T>(configure: (r: ServiceRegistrar) => ServiceWrapper<T>): this {
    const wrapper = configure(new ServiceRegistrar());
    const container = new SingletonLifecycle(
      wrapper.factory,
      wrapper.dependencies
    );
    this._registrations[wrapper.name] = container;
    return this;
  }

  addScoped<T>(configure: (r: ServiceRegistrar) => ServiceWrapper<T>): this {
    const wrapper = configure(new ServiceRegistrar());
    const container = new ScopedLifecycle(
      wrapper.factory,
      wrapper.dependencies
    );
    this._registrations[wrapper.name] = container;
    return this;
  }
}
```

### Custom Lifecycle Integration

```typescript
// Framework extension point
interface CustomLifecycleOptions {
  maxInstances?: number;
  ttlMinutes?: number;
  cleanupInterval?: number;
}

class CustomLifecycle implements Container {
  constructor(
    private readonly _factory: Factory<any>,
    private readonly _dependencies: readonly ServiceKey<any>[],
    private readonly _options: CustomLifecycleOptions
  ) {}

  resolve(serviceProvider: ServiceLocator): any {
    // Custom lifecycle logic
  }
}
```

## Consequences

### Positive

- **Clean Architecture**: Clear separation of lifecycle responsibilities
- **Performance**: Each lifecycle optimized for its use case
- **Extensible**: Easy to add new lifecycle types
- **Maintainable**: Changes isolated to specific lifecycle implementations

### Negative

- **Duplication**: Some dependency resolution logic repeated
- **Complexity**: More classes to understand and maintain
- **Coordination**: Ensuring consistent patterns across strategies

## Guidelines

### Implementing Custom Lifecycles

1. **Implement Container interface** - ensures compatibility
2. **Handle dependencies consistently** - follow existing patterns
3. **Consider disposal** - implement cleanup if needed
4. **Optimize for use case** - don't carry unnecessary state

### Lifecycle Selection Guidelines

- **Singleton**: Expensive to create, stateless, or truly global services
- **Scoped**: Request/session-bound services, connection management
- **Transient**: Lightweight services, stateful services needing isolation
- **Custom**: Special requirements like pooling, caching, or TTL

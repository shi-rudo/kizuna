# ADR-004: Immutable Service Container Design

## Status

Accepted

## Context

Kizuna needed to decide how to handle service wrapper mutability and dependency modification after registration. Three approaches were considered:

1. **Mutable Service Wrappers**: Allow runtime modification of dependencies and configuration
2. **Copy-on-Write**: Create new instances when modifications are needed
3. **Immutable Design**: Prevent all modifications after creation

## Decision

We chose the **Immutable Design** approach with frozen dependencies and read-only service wrappers.

## Rationale

### Immutability Implementation

```typescript
class ServiceWrapper<T> {
  readonly dependencies: readonly ServiceKey<any>[];

  constructor(
    private readonly _name: string,
    private readonly _type: Constructor<T> | null,
    dependencies: ServiceKey<any>[]
  ) {
    this.dependencies = Object.freeze([...dependencies]);
  }
}
```

### Benefits of Immutable Design

#### 1. **Predictable Behavior**

```typescript
// Registration time
builder.addSingleton((r) =>
  r.fromType(UserService).withDependencies(DatabaseService, LoggerService)
);

// Runtime - dependencies cannot change
const wrapper = container.getWrapper("UserService");
// wrapper.dependencies is frozen - no modifications possible
```

- Service dependencies are fixed at registration time
- No surprise behavior from runtime dependency changes
- Consistent resolution behavior across application lifecycle

#### 2. **Thread Safety**

```typescript
// Safe concurrent access
const wrapper = container.getWrapper("UserService");
const deps1 = wrapper.dependencies; // Thread 1
const deps2 = wrapper.dependencies; // Thread 2
// Both threads see identical, immutable dependency arrays
```

- Eliminates race conditions in multi-threaded environments
- No need for synchronization when accessing service metadata
- Safe to cache dependency arrays and service wrappers

#### 3. **Debug-Friendly**

```typescript
// Dependencies cannot be accidentally modified during debugging
console.log(wrapper.dependencies); // Always shows original registration
// wrapper.dependencies.push(NewService); // TypeError: Cannot add property
```

- Service configuration is tamper-proof during debugging
- Easier to reason about service resolution issues
- Registration-time configuration is preserved throughout runtime

#### 4. **Memory Efficiency**

```typescript
// Safe to share service wrappers across containers
const sharedWrapper = new ServiceWrapper("Service", Type, deps);
container1.register(sharedWrapper);
container2.register(sharedWrapper); // Safe - cannot modify
```

- Service wrappers can be safely shared between containers
- No defensive copying needed when passing wrappers around
- Reduced memory allocations for duplicate service configurations

### Implementation Details

#### Dependency Array Freezing

```typescript
constructor(/* ... */) {
  // Create defensive copy and freeze
  this.dependencies = Object.freeze([...dependencies]);
}
```

- `Object.freeze()` prevents array modification
- Spread operator `[...dependencies]` creates defensive copy
- Original dependency array from caller cannot affect frozen copy

#### Read-Only Properties

```typescript
class ServiceWrapper<T> {
  readonly dependencies: readonly ServiceKey<any>[];
  private readonly _name: string;
  private readonly _type: Constructor<T> | null;
}
```

- `readonly` modifier prevents property reassignment
- Private fields prevent external access to mutable state
- TypeScript compiler enforces immutability at build time

#### Container Registration Protection

```typescript
// Container registrations map is internal and protected
private readonly registrations: Record<string, Container> = {};

// No public methods to modify registrations after build()
build(): ServiceProvider {
  return new ServiceProvider(this.registrations); // Copies map
}
```

### Trade-offs Accepted

#### Advantages

- **Reliability**: No unexpected behavior from runtime modifications
- **Performance**: Safe to cache and share service metadata
- **Debugging**: Clear contract about when configuration is locked
- **Concurrency**: Thread-safe by design
- **Memory**: Enables safe sharing of service wrappers

#### Disadvantages

- **Flexibility**: Cannot modify service configuration after registration
- **Dynamic Scenarios**: Harder to implement runtime service swapping
- **Testing**: Cannot easily modify dependencies for test scenarios
- **Hot Reload**: Development-time service replacement is more complex

### Alternatives Considered

#### Mutable Service Wrappers

```typescript
// Rejected approach
class ServiceWrapper<T> {
  dependencies: ServiceKey<any>[];

  addDependency(dep: ServiceKey<any>): void {
    this.dependencies.push(dep);
  }
}
```

- **Rejected**: Unpredictable resolution behavior
- **Rejected**: Race conditions in concurrent environments
- **Rejected**: Debugging complexity from runtime modifications

#### Copy-on-Write

```typescript
// Rejected approach
class ServiceWrapper<T> {
  withAdditionalDependency(dep: ServiceKey<any>): ServiceWrapper<T> {
    return new ServiceWrapper(this._name, this._type, [
      ...this.dependencies,
      dep,
    ]);
  }
}
```

- **Rejected**: Complex API with proliferation of `with*` methods
- **Rejected**: Memory overhead from frequent copying
- **Rejected**: Unclear semantics about when copies are created

#### Lazy Freezing

```typescript
// Rejected approach
class ServiceWrapper<T> {
  private _frozen = false;

  freeze(): void {
    this._frozen = true;
    Object.freeze(this.dependencies);
  }
}
```

- **Rejected**: Adds complexity with freeze state management
- **Rejected**: Still allows modifications before freezing
- **Rejected**: Unclear lifecycle about when freezing occurs

## Implementation Pattern

### Service Registration

```typescript
// Immutable from creation
const wrapper = new ServiceWrapper("UserService", UserService, [
  DatabaseService,
  LoggerService,
]);

// Dependencies are frozen and read-only
console.log(wrapper.dependencies); // readonly ServiceKey<any>[]
```

### Container Building

```typescript
class ContainerBuilder {
  private readonly _registrations: ServiceWrapper<any>[] = [];

  build(): ServiceProvider {
    // Build-time freezing of container state
    const registrations = this.createRegistrationMap();
    return new ServiceProvider(registrations);
  }
}
```

### Scope Creation

```typescript
// Immutable wrappers can be safely shared across scopes
startScope(): ServiceProvider {
  const scopedRegistrations = this.cloneWithScopedLifecycles();
  return new ServiceProvider(scopedRegistrations);
}
```

## Consequences

### Positive

- **Predictable**: Service configuration locked at registration time
- **Safe**: Thread-safe and tamper-proof service metadata
- **Efficient**: Enables sharing and caching of service wrappers
- **Simple**: Clear immutability contract reduces cognitive load

### Negative

- **Rigid**: Cannot modify services after registration
- **Testing**: Harder to replace dependencies for testing
- **Dynamic**: Limits runtime service configuration scenarios

## Workarounds for Dynamic Scenarios

### Factory-Based Dynamic Dependencies

```typescript
// Use factories for runtime dependency selection
builder.addSingleton((r) =>
  r.fromName("Service").useFactory((provider) => {
    const condition = provider.get<Config>("Config").useFeatureX;
    const dep = condition
      ? provider.get(FeatureXService)
      : provider.get(DefaultService);
    return new Service(dep);
  })
);
```

### Multiple Container Strategy

```typescript
// Create new containers for different configurations
const devContainer = createDevContainer();
const prodContainer = createProdContainer();
const testContainer = createTestContainer();
```

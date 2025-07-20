# ADR-001: Explicit Async Initialization Pattern

## Status

Accepted

## Context

Kizuna is a dependency injection library that needs to handle services requiring asynchronous initialization (e.g., database connections, external API clients, configuration loading). Two primary approaches were considered:

1. **Explicit Two-Container Pattern** (Current): Users create separate containers for async initialization and dependent service resolution
2. **Seamless Async Resolution**: Container automatically handles async services with `await container.get()` everywhere

## Decision

We chose the **Explicit Two-Container Pattern** for async service initialization.

## Rationale

### Benefits of Current Approach

#### 1. **Performance Optimization**

```typescript
// Fast synchronous resolution for majority use case
const service = container.get(MyService); // No async overhead
```

- Synchronous services don't pay async performance cost
- No Promise overhead for services that don't need it
- Predictable execution time for sync operations

#### 2. **Explicit Control Flow**

```typescript
// Clear separation of initialization phases
const config = await container1.get("ConfigService"); // Explicit async
const dbService = container2.get(DatabaseService); // Fast sync
```

- Users see exactly when async work happens
- No hidden async behavior or "magic"
- Clear distinction between initialization and runtime phases

#### 3. **Superior Error Handling**

```typescript
try {
  const config = await asyncContainer.get("Config");
} catch (error) {
  // Clearly an initialization error
}

try {
  const service = syncContainer.get("Service");
} catch (error) {
  // Clearly a resolution/dependency error
}
```

- Separation between initialization failures and runtime resolution errors
- Easier debugging and error categorization
- Users can implement different error handling strategies for each phase

#### 4. **Predictable Debugging**

- Stack traces clearly show which container and phase caused issues
- No async state pollution in synchronous resolution paths
- Easier to reason about service lifetimes and dependencies

#### 5. **Follows DI Best Practices**

- Aligns with composition root pattern where async initialization happens at application startup
- Separates concerns: async setup vs sync runtime usage
- Matches how most production applications actually work

### Problems with Seamless Approach

#### 1. **Hidden Complexity**

```typescript
// Unclear: Is this actually async? What's the performance cost?
const service = await container.get("Service");
```

#### 2. **Mixed Paradigms**

- Forces async API on services that don't need it
- Creates inconsistent usage patterns
- Pollutes synchronous code with async/await

#### 3. **Performance Degradation**

- Every service resolution becomes async operation
- Unnecessary Promise allocation and microtask scheduling
- Impacts hot paths in request/response cycles

#### 4. **Error Ambiguity**

- Harder to distinguish between different failure modes
- Async errors can mask synchronous resolution issues
- Complex error handling for different scenarios

## Implementation Pattern

### Phase 1: Async Initialization

```typescript
const builder1 = new ContainerBuilder();
builder1.addSingleton((r) =>
  r.fromName("ConfigService").useFactory(async (provider) => {
    const config = await loadConfiguration();
    return new ConfigService(config);
  })
);

const container1 = builder1.build();
const config = await container1.get<ConfigService>("ConfigService");
```

### Phase 2: Dependent Service Registration

```typescript
const builder2 = new ContainerBuilder();
builder2.addSingleton((r) =>
  r.fromName("ConfigService").useFactory(() => config)
);
builder2.addSingleton((r) =>
  r.fromType(DatabaseService).withDependencies("ConfigService")
);

const container2 = builder2.build();
const dbService = container2.get(DatabaseService); // Synchronous
```

## Consequences

### Positive

- **High Performance**: Synchronous resolution for runtime operations
- **Clear Mental Model**: Explicit phases make code easier to understand
- **Better Debugging**: Clear error boundaries and stack traces
- **Flexible**: Users control exactly how async initialization happens

### Negative

- **More Ceremony**: Requires creating two containers for async scenarios
- **Documentation Need**: Pattern must be clearly explained to users
- **Slightly More Code**: Users write more lines for async initialization

## Alternatives Considered

### 1. Global Async Container

- **Rejected**: Forces async everywhere, poor performance
- **Rejected**: Violates principle of least surprise

### 2. Mixed Sync/Async APIs

- **Rejected**: Creates inconsistent developer experience
- **Rejected**: Difficult to implement correctly

### 3. Lazy Async Resolution

- **Rejected**: Moves async complexity to runtime instead of startup
- **Rejected**: Unpredictable performance characteristics

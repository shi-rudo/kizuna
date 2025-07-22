# ADR-010: Concurrency Responsibility Separation

## Status
**Accepted** - 2025-01-24

## Context

During development, the question arose whether Kizuna should provide built-in thread-safe implementations of its core lifecycle classes (Singleton, Scoped, Transient) to handle concurrent access scenarios such as:

- Multi-threaded Node.js applications using Worker Threads
- Browser applications with Web Workers and SharedArrayBuffer
- High-concurrency server applications with shared container state

Initial exploration included implementing thread-safe versions using async-mutex, but this raised fundamental architectural questions about responsibility separation and performance trade-offs.

## Decision

**Kizuna will NOT provide built-in thread-safe implementations.** Instead, concurrency concerns are the responsibility of the consuming application.

## Rationale

### 1. Single Responsibility Principle
- **Kizuna's Core Responsibility**: Dependency injection, service lifecycle management, type safety, and developer experience
- **Application's Responsibility**: Concurrency patterns, thread coordination, async flow control, and performance optimization

Mixing these concerns would violate separation of responsibilities and create a more complex, harder-to-maintain library.

### 2. Performance First for Common Cases
**99% of JavaScript applications run in single-threaded environments:**
- Node.js main thread (most server applications)
- Browser main thread (most web applications)  
- CLI tools and scripts
- Single-threaded serverless functions

Adding async overhead to **all operations** to solve **rare concurrency cases** would:
- Degrade performance for the majority use case
- Force unnecessary Promise handling throughout codebases
- Add complexity to the API surface area

### 3. JavaScript Concurrency Model
JavaScript's event-driven, single-threaded model means:
- Most concurrency is handled through async/await and event loops
- True multi-threading is the exception, not the rule
- When multi-threading is used, applications typically architect around it

### 4. Better Architectural Patterns Exist
Applications needing concurrency can use proven patterns:

**Container-per-Thread/Worker:**
```typescript
// Each thread gets its own container instance
const container = new ContainerBuilder()
    .registerSingleton('Service', MyService)
    .build();
```

**Request-Scoped Isolation:**
```typescript
// Each request gets isolated service instances
app.use((req, res, next) => {
    req.services = rootContainer.startScope();
    res.on('finish', () => req.services.dispose());
});
```

**Message Passing:**
```typescript
// Avoid shared state entirely
worker.postMessage({ type: 'PROCESS_DATA', data: payload });
```

### 5. Industry Alignment
Major DI frameworks follow similar patterns:
- **ASP.NET Core**: Single-threaded per request with scoped services
- **Spring Framework**: Thread-safe singletons, but request-scoped instances
- **Angular**: Single-threaded with hierarchical injectors
- **Dagger (Android)**: Component-per-scope architecture

None provide built-in async/threading in their core DI resolution.

### 6. Principle of Least Astonishment
Developers expect DI containers to be:
- Fast and synchronous by default
- Simple to use for common cases
- Free of unnecessary async ceremony

Making all operations async would surprise developers and create friction.

## Consequences

### Positive
- **Simple, Fast API**: Synchronous operations with minimal overhead
- **Clear Responsibility**: Kizuna focuses on DI, apps handle concurrency
- **Better Performance**: No async overhead for single-threaded scenarios
- **Easier Testing**: Synchronous operations are easier to test and debug
- **Smaller Bundle Size**: No additional concurrency dependencies

### Negative
- **Manual Concurrency Handling**: Applications must implement their own patterns
- **Documentation Burden**: Must clearly document concurrency considerations
- **Potential Misuse**: Developers might share containers unsafely

### Mitigation Strategies
1. **Comprehensive Documentation**: Detailed guide on concurrency patterns
2. **Clear Warnings**: Documentation about unsafe sharing patterns
3. **Best Practice Examples**: Sample implementations for common scenarios
4. **Architecture Guidance**: Recommendations for concurrent applications

## Implementation

1. Remove any thread-safe implementations from the codebase
2. Keep existing synchronous lifecycle implementations
3. Document concurrency considerations in README
4. Create detailed concurrency patterns guide
5. Add examples for common concurrent scenarios

## Alternatives Considered

### Alternative 1: Async-First API
Make all operations async to support thread-safe implementations.

**Rejected because:**
- Degrades performance for 99% of use cases
- Adds unnecessary complexity to simple scenarios
- Goes against JavaScript's typical DI patterns

### Alternative 2: Configurable Thread Safety
Provide both sync and async versions with configuration flags.

**Rejected because:**
- Doubles the API surface area
- Creates two different programming models
- Increases maintenance burden significantly

### Alternative 3: Optional Thread-Safe Package
Separate `@shirudo/kizuna-threadsafe` package.

**Rejected because:**
- Fragments the ecosystem
- Creates version compatibility issues
- Still violates single responsibility principle

## References

- [Dependency Injection Patterns in JavaScript](https://martinfowler.com/articles/injection.html)
- [Node.js Worker Threads Documentation](https://nodejs.org/api/worker_threads.html)
- [Web Workers and Service Workers Patterns](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [ASP.NET Core Dependency Injection](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection)

---

**Next Steps:**
1. Create comprehensive concurrency patterns documentation
2. Update README with concurrency considerations
3. Add example implementations for common concurrent scenarios
# ADR-001: Unified Container with Seamless Async Resolution

## Status

Accepted (Supersedes the previous "Explicit Two-Container Pattern")

## Context

Modern applications frequently require services that depend on asynchronous initialization, such as establishing a database connection, fetching remote configurations, or initializing an API client. A dependency injection container must provide a clear, efficient, and ergonomic way to manage these asynchronous operations without compromising performance or developer experience for synchronous services.

The initial design of this library adopted an **Explicit Two-Container Pattern**. This approach enforced a strict separation between an "async container" for initialization and a "sync container" for runtime resolution. While this pattern was highly explicit about the application's lifecycle phases, it introduced significant boilerplate and required developers to manually manage two separate container instances, passing resolved async services from the first container to the second.

## Decision

We have **superseded the two-container pattern** in favor of a **Unified Container model with seamless async resolution**.

The `ContainerBuilder` now directly supports `async` factory functions. When a service is registered with an `async` factory, the container correctly infers its return type as a `Promise<T>`. Consequently, `container.get()` for that service returns a `Promise` that resolves to the service instance. This `Promise` is cached for singleton and scoped lifecycles, ensuring the underlying asynchronous operation is executed only once per lifecycle.

## Rationale

This decision was driven by the goal of improving developer experience while maintaining the core principles of explicitness and performance.

1.  **Superior Developer Experience**: The unified API is significantly simpler and more intuitive. Developers can configure all their services, both sync and async, in a single `ContainerBuilder` instance, which drastically reduces boilerplate and cognitive overhead.

2.  **Explicit Where It Matters**: Asynchronicity remains explicit at the point of definition (`registerSingletonFactory(async ...)` and at the point of resolution (`await container.get('asyncService')`). This preserves clarity about where I/O-bound or time-consuming operations occur without polluting the entire container API or forcing synchronous services to adopt an async pattern.

3.  **Optimized Performance**: The performance concerns that led to the original two-container pattern are effectively mitigated.
    *   **Synchronous services are unaffected**: They are resolved synchronously with zero `Promise` overhead.
    *   **Asynchronous services are efficient**: For singleton and scoped services, the `Promise` returned by the async factory is cached. Subsequent calls to `get()` return the same cached `Promise`, ensuring the expensive initialization logic runs only once.

4.  **Full Type Safety**: The `ContainerBuilder`'s powerful type inference correctly identifies that an `async` factory produces a `Promise`. This means TypeScript will enforce that the result of `container.get()` for that service must be `await`-ed, preventing common runtime errors.

5.  **Alignment with Modern Asynchronous Patterns**: This model aligns perfectly with modern TypeScript and JavaScript, where `async/await` is a first-class language feature for managing asynchronous operations.

## Implementation Pattern

The pattern involves a single, unified registration and resolution phase.

### Phase 1: Unified Registration

All services are registered using a single `ContainerBuilder`.

```typescript
const builder = new ContainerBuilder();

// Register a standard synchronous service (e.g., a logger)
builder.registerSingleton('Logger', Logger);

// Register an asynchronous service (e.g., a database connection)
// The factory is an `async` function.
builder.registerSingletonFactory('Database', async (provider) => {
  const logger = provider.get('Logger'); // Sync dependency resolved instantly
  logger.log('Initiating database connection...');
  
  // The actual async operation
  const connection = await connectToDatabase({ retries: 3 }); 
  
  logger.log('Database connection established.');
  return new DatabaseService(connection);
});

// Build the single, unified container
const container = builder.build();
```

### Phase 2: Unified Resolution

The same container instance is used to resolve all services.

```typescript
// Synchronous resolution for a synchronous service
const logger = container.get('Logger'); // Returns a Logger instance directly

// Asynchronous resolution for an asynchronous service
// The `await` keyword is required here, enforced by TypeScript.
const dbService = await container.get('Database'); // Returns a Promise<DatabaseService>

// Now you can use both services
logger.log('Starting application logic...');
dbService.query('SELECT * FROM users');
```

## Consequences

### Positive

*   **Drastically Reduced Boilerplate**: Eliminates the need for managing and wiring multiple containers.
*   **Improved Ergonomics**: The API is more intuitive and aligns with standard `async/await` patterns.
*   **Single Source of Truth**: One container holds the registration for all services, simplifying debugging and maintenance.
*   **High Performance**: The performance of synchronous resolution paths is preserved, and async resolution is optimized through caching.

### Negative

*   **Awaiting is Required**: Developers must remember to `await` the result of `get()` for services registered with an `async` factory. However, this is a standard pattern in modern JavaScript and is enforced by the type system.
*   **Error Handling**: The distinction between an initialization-time error and a runtime error is now handled by `try...catch` blocks around `await container.get()`, which is a slightly less rigid separation than the two-container model but is a very common and well-understood pattern.

## Alternatives Considered

### The Explicit Two-Container Pattern

*   **Description**: Use one container for async initialization and a second for sync runtime resolution.
*   **Reason for Rejection**: This pattern was rejected because its benefits in explicitness were heavily outweighed by the significant increase in code complexity, boilerplate, and overall poor developer experience. The unified model provides a better balance of clarity and ergonomics.
# ADR-008: Decoupled Provider for Factory Functions

## Status

Accepted (Supersedes previous "Self-Registration Pattern")

## Context

For factory functions to be useful, they need a mechanism to resolve the dependencies required to construct a service. A key architectural decision was how to provide this capability. The primary options were:

1.  **Automatic Self-Registration**: The service provider would automatically register itself as a resolvable service within the container. This would allow any service to inject the provider.
2.  **No Self-Registration**: The service provider would not be a resolvable service, preventing it from being injected into regular services.
3.  **Manual Registration**: Require the user to explicitly register the service provider if they wanted to inject it.

The library initially implemented automatic self-registration.

## Decision

We have **reversed the original decision**. The service provider is **no longer a self-registered or resolvable service**. 

Instead, the `TypeSafeServiceLocator` (the provider) is **explicitly passed as an argument only to factory functions** at the time of resolution. It cannot be injected into a service's constructor.

## Rationale

This change was made to enforce a cleaner dependency injection architecture and discourage the use of the Service Locator, which is widely considered an anti-pattern.

1.  **Discourages the Service Locator Anti-Pattern**: When the container itself is injectable, services can use it to fetch their own dependencies. This hides the service's true dependencies, making the code harder to understand, test, and maintain. By making the provider non-injectable, we force dependencies to be declared explicitly in the service's constructor.

2.  **Promotes Clear, Explicit Dependencies**: A class's dependencies should be part of its public contract (the constructor signature). The new model enforces this. It is immediately clear what a service needs to function, without having to read its implementation to see what it resolves from a service locator.

3.  **Vastly Improved Testability**: Services that do not depend on the container are much easier to unit test. Dependencies can be mocked and passed directly to the constructor. If a service depends on the provider, tests would need to construct and configure a full container instance, which is complex and couples the test to the DI framework.

4.  **Preserves the Power of Factories**: The primary legitimate use case for accessing the provider is within factory functions for complex, conditional, or dynamic service creation. The new model retains this power precisely where it is needed, without exposing the provider to the rest of the application.

## Implementation Pattern

The service provider is not a registered service. Attempting to inject it will fail.

### Incorrect Usage (No Longer Possible)

```typescript
// This service attempts to inject the provider, which is an anti-pattern.
class MyService {
  constructor(private provider: TypeSafeServiceLocator<{}>) { // This will fail
    // ...
  }
}

// The following registration would lead to a resolution error because
// `TypeSafeServiceLocator` is not a registered service.
const builder = new ContainerBuilder()
  .registerSingleton('MyService', MyService, 'TypeSafeServiceLocator');
```

### Correct Usage (Factory-Based)

The provider is passed as an argument to the factory function, where its use is appropriate.

```typescript
// A factory function receives the provider to resolve dependencies.
const container = new ContainerBuilder()
  .registerSingleton('Logger', Logger)
  .registerSingletonFactory('ComplexService', (provider) => { // provider is passed here
    const logger = provider.get('Logger'); // Correctly resolve dependencies
    
    // Perform complex or conditional logic
    if (process.env.NODE_ENV === 'development') {
      return new ComplexService(logger, new DevTools());
    } else {
      return new ComplexService(logger, new ProdTools());
    }
  })
  .build();

// The service is created via its factory, which correctly uses the provider.
const service = container.get('ComplexService');
```

## Consequences

### Positive

*   **Architectural Integrity**: Prevents the Service Locator anti-pattern and promotes a clean DI architecture.
*   **Improved Testability**: Services are easier to unit test in isolation.
*   **Clear Dependencies**: A service's dependencies are made explicit in its constructor.
*   **Reduced Complexity**: Eliminates the risk of hidden dependencies and complex resolution paths inside services.

### Negative

*   **More Ceremony for Dynamic Resolution**: If a service genuinely needs to resolve dependencies dynamically, it *must* be constructed via a factory. This is a positive trade-off, as it makes the choice to use dynamic resolution an explicit architectural decision.

## Alternatives Considered

### Automatic Self-Registration

*   **Description**: The provider automatically registers itself as an injectable service.
*   **Reason for Rejection**: This was the previous model. It was rejected because it actively encourages the Service Locator anti-pattern, which leads to poor architectural outcomes regarding testability and maintainability.

### Manual Registration

*   **Description**: Allow the user to explicitly register the provider if they want to inject it.
*   **Reason for Rejection**: This is verbose and still enables the anti-pattern. The goal is to guide users toward a better architecture, and allowing manual registration would be a loophole that undermines that goal.
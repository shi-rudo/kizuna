# ADR-008: Decoupled Provider and Explicit Self-Resolution

## Status

Accepted (Supersedes previous "Self-Registration Pattern")

## Context

For factory functions to be useful, they need a mechanism to resolve the dependencies required to construct a service. A key architectural decision was how to provide this capability. The primary options were:

1.  **Automatic Self-Registration**: The service provider would automatically register itself as a resolvable service within the container. This would allow any service to inject the provider.
2.  **No Self-Registration**: The service provider would not be a resolvable service, preventing it from being injected into regular services.
3.  **Manual Registration**: Require the user to explicitly register the service provider if they wanted to inject it.

The library initially implemented automatic self-registration.

## Decision

We have **reversed the original automatic self-registration decision**. The
service provider is not stored in the normal string-key registry.

The `TypeSafeServiceLocator` is passed directly to factory functions at
resolution time. Infrastructure code can also call `get(ServiceProviderToken)`
to get the current root or scoped provider. This lookup uses an exported unique
symbol; it is not a hidden service registration.

The symbol token `ServiceProviderToken` and the string key `"ServiceProvider"`
are separate. Users can register the string key without
overwriting provider self-resolution. The provider cannot be injected through a
string dependency unless the user registers a value under that string. No other
constructor is a resolution token. Registered services are resolved through
their string keys, so runtime resolution does not depend on `constructor.name`.

## Rationale

This change was made to enforce a cleaner dependency injection architecture and discourage the use of the Service Locator, which is widely considered an anti-pattern.

1.  **Discourages the Service Locator Anti-Pattern**: The provider is not placed
    in the string-key registry, so normal constructor injection does not receive
    it implicitly. Services must declare their actual dependencies.

2.  **Promotes Clear, Explicit Dependencies**: A class's dependencies should be part of its public contract (the constructor signature). The new model enforces this. It is immediately clear what a service needs to function, without having to read its implementation to see what it resolves from a service locator.

3.  **Vastly Improved Testability**: Services that do not depend on the container are much easier to unit test. Dependencies can be mocked and passed directly to the constructor. If a service depends on the provider, tests would need to construct and configure a full container instance, which is complex and couples the test to the DI framework.

4.  **Preserves the Power of Factories**: Factory functions receive the current
    provider directly for complex or conditional service creation.

5.  **Prevents Key Collisions**: Symbol identity cannot overwrite a user
    registration that happens to use the same text as the token description.

## Implementation Pattern

The service provider is not a registered string-key service. Attempting to
inject it without a user registration will fail.

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

### Explicit Infrastructure Lookup

```typescript
import { ContainerBuilder, ServiceProviderToken } from '@shirudo/kizuna';

class DiagnosticService {}

const container = new ContainerBuilder()
  .registerSingleton('ServiceProvider', DiagnosticService)
  .build();

container.get(ServiceProviderToken); // The current provider
container.get('ServiceProvider');    // DiagnosticService
```

## Consequences

### Positive

*   **Architectural Integrity**: Prevents the Service Locator anti-pattern and promotes a clean DI architecture.
*   **Improved Testability**: Services are easier to unit test in isolation.
*   **Clear Dependencies**: A service's dependencies are made explicit in its constructor.
*   **Reduced Complexity**: Eliminates hidden provider registrations and keeps
    the one explicit infrastructure token separate from user keys.

*   **Stable Resolution**: Service lookup does not depend on constructor names,
    which build tools can change.

### Negative

*   **More Ceremony for Dynamic Resolution**: If a service genuinely needs to resolve dependencies dynamically, it *must* be constructed via a factory. This is a positive trade-off, as it makes the choice to use dynamic resolution an explicit architectural decision.

## Alternatives Considered

### Automatic Self-Registration

*   **Description**: The provider automatically registers itself under a string
    key within the container.
*   **Reason for Rejection**: This was the previous model. It was rejected because it actively encourages the Service Locator anti-pattern, which leads to poor architectural outcomes regarding testability and maintainability.

### Manual Registration

*   **Description**: Require the user to explicitly register the provider under
    a string key if they want to inject it.
*   **Reason for Rejection**: This is verbose and enables hidden service-locator
    dependencies. Factory arguments and explicit symbol-token lookup cover
    the intended infrastructure use cases.

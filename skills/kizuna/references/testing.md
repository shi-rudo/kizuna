# Testing

## Create a test container with stubs

Build a separate container for tests with mock implementations registered via factories.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import { describe, it, expect, vi } from 'vitest';

class MockLogger {
  messages: string[] = [];
  log(msg: string) { this.messages.push(msg); }
}

class MockDatabase {
  users = [{ id: '1', name: 'Alice' }];
  findUser(id: string) { return this.users.find(u => u.id === id); }
}

function createTestContainer() {
  return new ContainerBuilder()
    .registerSingletonFactory('logger', () => new MockLogger())
    .registerSingletonFactory('database', () => new MockDatabase())
    .registerScoped('userService', UserService, 'database', 'logger')
    .build();
}

describe('UserService', () => {
  it('finds a user by id', () => {
    const container = createTestContainer();
    const scope = container.startScope();

    const userService = scope.get('userService');
    const user = userService.findById('1');

    expect(user).toEqual({ id: '1', name: 'Alice' });
    scope.dispose();
  });
});
```

## Override a single registration

Build a helper that creates the production container but swaps one service.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

function createContainerWithOverride<T>(
  key: string,
  mockFactory: () => T,
) {
  return new ContainerBuilder()
    .registerSingleton('logger', Logger)
    .registerSingleton('database', DatabaseService, 'logger')
    .registerScoped('userService', UserService, 'database', 'logger')
    // Override: re-register with mock — last registration wins
    .registerSingletonFactory(key, mockFactory as any)
    .build();
}

describe('UserService with mock database', () => {
  it('uses the mock', () => {
    const container = createContainerWithOverride('database', () => ({
      findUser: (id: string) => ({ id, name: 'Test User' }),
    }));

    const scope = container.startScope();
    const userService = scope.get('userService');
    expect(userService.findById('42').name).toBe('Test User');
    scope.dispose();
  });
});
```

Kizuna logs a warning when overwriting a registration but allows it. This is the simplest way to swap a single dependency for testing.

## Test scoped lifecycle isolation

Verify that scoped services are isolated between scopes and shared within a scope.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import { describe, it, expect } from 'vitest';

describe('Scoped lifecycle', () => {
  const container = new ContainerBuilder()
    .registerScopedFactory('counter', () => ({ value: 0 }))
    .build();

  it('shares instance within a scope', () => {
    const scope = container.startScope();
    const a = scope.get('counter');
    const b = scope.get('counter');
    expect(a).toBe(b); // Same instance
    a.value = 10;
    expect(b.value).toBe(10);
    scope.dispose();
  });

  it('isolates instances between scopes', () => {
    const scope1 = container.startScope();
    const scope2 = container.startScope();
    const a = scope1.get('counter');
    const b = scope2.get('counter');
    expect(a).not.toBe(b); // Different instances
    a.value = 99;
    expect(b.value).toBe(0);
    scope1.dispose();
    scope2.dispose();
  });
});
```

## Test disposal behavior

Verify that scoped services with a `dispose()` method are cleaned up.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import { describe, it, expect, vi } from 'vitest';

class DisposableService {
  disposed = false;
  dispose() { this.disposed = true; }
}

describe('Scope disposal', () => {
  it('calls dispose on scoped instances', () => {
    const container = new ContainerBuilder()
      .registerScopedFactory('service', () => new DisposableService())
      .build();

    const scope = container.startScope();
    const service = scope.get('service');
    expect(service.disposed).toBe(false);

    scope.dispose();
    expect(service.disposed).toBe(true);
  });
});
```

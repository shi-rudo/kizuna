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

Verify that both scoped and singleton services with a `dispose()` method are cleaned up.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import { describe, it, expect } from 'vitest';

class DisposableService {
  disposed = false;
  dispose() { this.disposed = true; }
}

describe('Disposal', () => {
  it('calls dispose on scoped instances when scope is disposed', () => {
    const container = new ContainerBuilder()
      .registerScoped('service', DisposableService)
      .build();

    const scope = container.startScope();
    const service = scope.get('service');
    expect(service.disposed).toBe(false);

    scope.dispose();
    expect(service.disposed).toBe(true);
  });

  it('calls dispose on singleton instances when root container is disposed', () => {
    const container = new ContainerBuilder()
      .registerSingleton('service', DisposableService)
      .build();

    const service = container.get('service');
    expect(service.disposed).toBe(false);

    container.dispose();
    expect(service.disposed).toBe(true);
  });

  it('does NOT dispose singletons when child scope is disposed', () => {
    const container = new ContainerBuilder()
      .registerSingleton('service', DisposableService)
      .build();

    const scope = container.startScope();
    const service = scope.get('service');

    scope.dispose();
    expect(service.disposed).toBe(false); // Still alive
  });

  it('throws on get() after container dispose', () => {
    const container = new ContainerBuilder()
      .registerSingleton('service', DisposableService)
      .build();

    container.dispose();
    expect(() => container.get('service')).toThrow(/disposed container/);
  });
});
```

## Test multi-registration with getAll

Verify that `add*` / `getAll()` returns all implementations in registration order.

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import { describe, it, expect } from 'vitest';

class ConsoleLogger {
  type = 'console' as const;
  log(msg: string) { console.log(msg); }
}

class FileLogger {
  type = 'file' as const;
  log(msg: string) { /* write to file */ }
}

describe('Multi-registration', () => {
  it('resolves all implementations via getAll()', () => {
    const container = new ContainerBuilder()
      .addSingleton('loggers', ConsoleLogger)
      .addSingleton('loggers', FileLogger)
      .build();

    const loggers = container.getAll('loggers');
    expect(loggers).toHaveLength(2);
    expect(loggers[0].type).toBe('console');
    expect(loggers[1].type).toBe('file');
  });

  it('supports mixed lifecycles under one key', () => {
    const container = new ContainerBuilder()
      .addSingleton('handlers', ConsoleLogger)
      .addScopedFactory('handlers', () => new FileLogger())
      .build();

    const scope1 = container.startScope();
    const scope2 = container.startScope();

    const handlers1 = scope1.getAll('handlers');
    const handlers2 = scope2.getAll('handlers');

    // Singleton is shared across scopes
    expect(handlers1[0]).toBe(handlers2[0]);
    // Scoped is different per scope
    expect(handlers1[1]).not.toBe(handlers2[1]);

    scope1.dispose();
    scope2.dispose();
  });

  it('disposes multi-registered singletons on container dispose', () => {
    let disposeCount = 0;
    const container = new ContainerBuilder()
      .addSingletonFactory('services', () => ({
        dispose() { disposeCount++; }
      }))
      .addSingletonFactory('services', () => ({
        dispose() { disposeCount++; }
      }))
      .build();

    container.getAll('services');
    container.dispose();
    expect(disposeCount).toBe(2);
  });
});
```

## Test container inspection with getRegisteredServiceNames and remove

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import { describe, it, expect } from 'vitest';

describe('Container inspection', () => {
  it('lists registered service names', () => {
    const builder = new ContainerBuilder()
      .registerSingleton('logger', Logger)
      .registerScoped('userService', UserService, 'logger');

    expect(builder.getRegisteredServiceNames()).toEqual(['logger', 'userService']);
  });

  it('removes a registration and validates', () => {
    const builder = new ContainerBuilder()
      .registerSingleton('logger', Logger)
      .registerScoped('userService', UserService, 'logger');

    expect(builder.remove('logger')).toBe(true);
    expect(builder.remove('nonExistent')).toBe(false);

    const issues = builder.validate();
    expect(issues.some(i => i.includes("'logger'"))).toBe(true);
  });
});
```

## Test validation

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';
import { describe, it, expect } from 'vitest';

describe('Validation', () => {
  it('catches missing dependencies', () => {
    const builder = new ContainerBuilder()
      .registerSingleton('userService', UserService, 'database');

    const issues = builder.validate();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('database');
  });

  it('catches circular dependencies', () => {
    const builder = new ContainerBuilder()
      .registerSingleton('a', ServiceA, 'b')
      .registerSingleton('b', ServiceB, 'a');

    const issues = builder.validate();
    expect(issues.some(i => i.toLowerCase().includes('circular'))).toBe(true);
  });

  it('validates multi-registration dependencies too', () => {
    const builder = new ContainerBuilder()
      .addSingleton('handlers', HandlerA, 'missingDep');

    const issues = builder.validate();
    expect(issues.some(i => i.includes('missingDep'))).toBe(true);
  });
});
```

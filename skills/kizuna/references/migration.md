# Migration

## From manual `new` chains

Replace hand-wired dependency graphs with the container.

### Before

```typescript
const logger = new Logger();
const config = new AppConfig();
const database = new DatabaseConnection(config);
const userRepo = new UserRepository(database, logger);
const orderRepo = new OrderRepository(database, logger);
const userService = new UserService(userRepo, orderRepo, logger);
```

### After

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

const builder = new ContainerBuilder()
  .registerSingleton('logger', Logger)
  .registerSingleton('config', AppConfig)
  .registerSingleton('database', DatabaseConnection, 'config')
  .registerScoped('userRepo', UserRepository, 'database', 'logger')
  .registerScoped('orderRepo', OrderRepository, 'database', 'logger')
  .registerScoped('userService', UserService, 'userRepo', 'orderRepo', 'logger');

const issues = builder.validate();
if (issues.length > 0) throw new Error(issues.join('\n'));
const container = builder.build();
```

### Migration steps

1. Identify all classes that are instantiated with `new` and passed as dependencies.
2. Register each class with a string key. Choose singleton for shared state, scoped for per-request state, transient for stateless.
3. Name the key to match the constructor parameter name in consuming classes (to pass strict parameter validation).
4. Call `validate()` to verify all dependencies are wired correctly.
5. Replace `new` chains with `container.get()` calls.

## From tsyringe

tsyringe uses decorators and tokens. Kizuna uses string keys and constructor parameter names.

### tsyringe

```typescript
import { injectable, inject, container } from 'tsyringe';

@injectable()
class UserService {
  constructor(
    @inject('IDatabase') private db: IDatabase,
    @inject('ILogger') private logger: ILogger,
  ) {}
}

container.registerSingleton<IDatabase>('IDatabase', PostgresDatabase);
container.registerSingleton<ILogger>('ILogger', ConsoleLogger);
const userService = container.resolve(UserService);
```

### Kizuna

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

// No decorators — services are plain classes
class UserService {
  constructor(private db: IDatabase, private logger: ILogger) {}
}

const container = new ContainerBuilder()
  .registerSingletonInterface<IDatabase>('db', PostgresDatabase)
  .registerSingletonInterface<ILogger>('logger', ConsoleLogger)
  .registerSingleton('userService', UserService, 'db', 'logger')
  .build();

const userService = container.get('userService');
```

### Key differences

| tsyringe | Kizuna |
| --- | --- |
| `@injectable()` on class | No decorator needed |
| `@inject('token')` on params | String key in registration matches param name |
| `container.resolve(Class)` | `container.get('key')` |
| Token strings are arbitrary | Keys should match constructor param names |
| Auto-registers with decorators | Explicit registration required |

## From inversify

inversify uses decorators, symbols, and binding syntax.

### inversify

```typescript
import { Container, injectable, inject } from 'inversify';

const TYPES = {
  Database: Symbol.for('Database'),
  Logger: Symbol.for('Logger'),
};

@injectable()
class UserService {
  constructor(
    @inject(TYPES.Database) private db: IDatabase,
    @inject(TYPES.Logger) private logger: ILogger,
  ) {}
}

const container = new Container();
container.bind<IDatabase>(TYPES.Database).to(PostgresDatabase).inSingletonScope();
container.bind<ILogger>(TYPES.Logger).to(ConsoleLogger).inSingletonScope();
container.bind(UserService).toSelf().inRequestScope();
```

### Kizuna

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

// No symbols needed — string keys replace tokens
// No decorators — plain classes
class UserService {
  constructor(private db: IDatabase, private logger: ILogger) {}
}

const container = new ContainerBuilder()
  .registerSingletonInterface<IDatabase>('db', PostgresDatabase)
  .registerSingletonInterface<ILogger>('logger', ConsoleLogger)
  .registerScoped('userService', UserService, 'db', 'logger')
  .build();
```

### Key differences

| inversify | Kizuna |
| --- | --- |
| `Symbol.for()` tokens | String keys |
| `@injectable()` + `@inject()` | No decorators |
| `.bind().to().inScope()` | `.registerSingleton()` / `.registerScoped()` |
| `inRequestScope()` | `registerScoped()` |
| `container.get(TYPES.X)` | `container.get('x')` |
| Supports property injection | Constructor injection only |

## From NestJS

NestJS has its own DI container. Kizuna replaces only the DI layer, not the framework.

### NestJS

```typescript
import { Injectable, Inject, Module } from '@nestjs/common';

@Injectable()
class UserService {
  constructor(@Inject('DATABASE') private db: IDatabase) {}
}

@Module({
  providers: [
    UserService,
    { provide: 'DATABASE', useClass: PostgresDatabase },
  ],
})
class AppModule {}
```

### Kizuna

```typescript
import { ContainerBuilder } from '@shirudo/kizuna';

class UserService {
  constructor(private db: IDatabase) {}
}

const container = new ContainerBuilder()
  .registerSingletonInterface<IDatabase>('db', PostgresDatabase)
  .registerScoped('userService', UserService, 'db')
  .build();
```

NestJS `@Module` organizes providers into feature modules. Kizuna has no module system — organize registrations into separate builder functions and compose them manually.

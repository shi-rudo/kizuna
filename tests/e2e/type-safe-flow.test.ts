import { expect, test } from 'vitest';
import { ContainerBuilder } from '../../src/api/container-builder';

// Test services for type safety verification
interface ILogger {
    log(message: string): void;
}

class ConsoleLogger implements ILogger {
    log(message: string): void {
        console.log(`[LOG]: ${message}`);
    }
}

class DatabaseService {
    constructor(private logger: ILogger) {}
    
    query(sql: string): string {
        this.logger.log(`Executing query: ${sql}`);
        return 'query result';
    }
}

class UserService {
    constructor(
        private db: DatabaseService,
        private logger: ILogger
    ) {}
    
    getUser(id: number): { id: number; name: string } {
        this.logger.log(`Getting user ${id}`);
        this.db.query(`SELECT * FROM users WHERE id = ${id}`);
        return { id, name: 'Test User' };
    }
}

test('should provide type-safe service registration and resolution', () => {
    // Type-safe service registration with fluent API
    const container = new ContainerBuilder()
        .registerSingleton('Logger', ConsoleLogger)
        .registerSingleton('DatabaseService', DatabaseService, 'Logger')
        .registerScoped('UserService', UserService, 'DatabaseService', 'Logger')
        .buildTypeSafe();

    // These should have correct types inferred automatically
    const logger = container.get('Logger'); // Type: ConsoleLogger
    const db = container.get('DatabaseService'); // Type: DatabaseService  
    const userService = container.get('UserService'); // Type: UserService

    // Verify the services work correctly
    expect(logger).toBeInstanceOf(ConsoleLogger);
    expect(db).toBeInstanceOf(DatabaseService);
    expect(userService).toBeInstanceOf(UserService);

    const user = userService.getUser(1);
    expect(user.id).toBe(1);
    expect(user.name).toBe('Test User');
});

test('should work with simple registration', () => {
    const container = new ContainerBuilder()
        .registerSingleton('Logger', ConsoleLogger)
        .buildTypeSafe();

    const logger = container.get('Logger'); // Type: ConsoleLogger

    expect(logger).toBeInstanceOf(ConsoleLogger);
});

test('should support scoped services', () => {
    const builder = new ContainerBuilder()
        .registerSingleton('Logger', ConsoleLogger)
        .registerScoped('UserService', UserService, 'DatabaseService', 'Logger')
        .registerScoped('DatabaseService', DatabaseService, 'Logger');

    const rootContainer = builder.buildTypeSafe();
    const scope1 = rootContainer.startScope();
    const scope2 = rootContainer.startScope();

    const userService1a = scope1.get('UserService');
    const userService1b = scope1.get('UserService'); // Same instance within scope
    const userService2 = scope2.get('UserService'); // Different instance in different scope

    expect(userService1a).toBe(userService1b); // Same within scope
    expect(userService1a).not.toBe(userService2); // Different across scopes
});

test('should maintain backward compatibility with original API', () => {
    const services = new ContainerBuilder();
    services.addSingleton(r => r.fromType(ConsoleLogger));
    services.addScoped(r => r.fromName('UserService').useType(UserService).withDependencies('DatabaseService', ConsoleLogger));
    services.addScoped(r => r.fromName('DatabaseService').useType(DatabaseService).withDependencies(ConsoleLogger));

    const serviceProvider = services.build();
    const userService = serviceProvider.get<UserService>('UserService');
    const logger = serviceProvider.get(ConsoleLogger);

    expect(userService).toBeInstanceOf(UserService);
    expect(logger).toBeInstanceOf(ConsoleLogger);
});
/**
 * TypeSafe API Tests
 * Tests for TypeSafeContainerBuilder functionality including:
 * - Basic registration and resolution
 * - Interface registration patterns
 * - Type safety features
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TypeSafeContainerBuilder } from '../src/api/type-safe-container-builder';
import { TestStub, TestStubWithOneDependency } from './test-dummies';

// Type-safe API specific test services
interface ILogger {
    log(message: string): void;
}

interface IDatabase {
    query(sql: string): any[];
}

class ConsoleLogger implements ILogger {
    public logs: string[] = [];
    
    log(message: string): void {
        this.logs.push(message);
        console.log(`[LOG]: ${message}`);
    }
}

class DatabaseService implements IDatabase {
    constructor(private logger: ILogger) {}
    
    query(sql: string): any[] {
        this.logger.log(`Executing: ${sql}`);
        return [{ id: 1, result: 'data' }];
    }
}

describe('TypeSafe API', () => {
    let builder: TypeSafeContainerBuilder;

    beforeEach(() => {
        builder = new TypeSafeContainerBuilder();
    });

    describe('Basic Registration', () => {
        it('should register singleton services with type inference', () => {
            const container = builder
                .registerSingleton('Logger', ConsoleLogger)
                .buildTypeSafe();
            
            const logger = container.get('Logger');
            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should register scoped services with dependencies', () => {
            const container = builder
                .registerSingleton('Logger', ConsoleLogger)
                .registerScoped('Database', DatabaseService, 'Logger')
                .buildTypeSafe();
            
            const database = container.get('Database');
            expect(database).toBeInstanceOf(DatabaseService);
        });

        it('should register transient services', () => {
            const container = builder
                .registerTransient('Service', TestStub)
                .buildTypeSafe();
            
            const service1 = container.get('Service');
            const service2 = container.get('Service');
            
            expect(service1).not.toBe(service2); // Different instances
        });
    });

    describe('Interface Registration', () => {
        it('should register interfaces with concrete implementations', () => {
            const container = builder
                .registerInterface<ILogger>('ILogger', ConsoleLogger)
                .buildTypeSafe();
            
            const logger = container.get('ILogger');
            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should handle complex interface dependency chains', () => {
            const container = builder
                .registerInterface<ILogger>('ILogger', ConsoleLogger)
                .registerInterface<IDatabase>('IDatabase', DatabaseService, 'ILogger')
                .buildTypeSafe();
            
            const database = container.get('IDatabase');
            expect(database).toBeInstanceOf(DatabaseService);
            
            const result = database.query('SELECT * FROM test');
            expect(result).toEqual([{ id: 1, result: 'data' }]);
        });

        it('should support scoped interfaces', () => {
            const container = builder
                .registerScopedInterface<ILogger>('ILogger', ConsoleLogger)
                .buildTypeSafe();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const logger1 = scope1.get('ILogger');
            const logger2 = scope2.get('ILogger');

            expect(logger1).not.toBe(logger2);
        });

        it('should support transient interfaces', () => {
            const container = builder
                .registerTransientInterface<ILogger>('ILogger', ConsoleLogger)
                .buildTypeSafe();

            const logger1 = container.get('ILogger');
            const logger2 = container.get('ILogger');

            expect(logger1).not.toBe(logger2);
        });
    });

    describe('Service Management', () => {
        it('should check if service is registered', () => {
            expect(builder.isRegistered('TestService')).toBe(false);

            builder.registerSingleton('TestService', TestStub);

            expect(builder.isRegistered('TestService')).toBe(true);
        });

        it('should return correct count of registered services', () => {
            expect(builder.count).toBe(0);

            builder
                .registerSingleton('Service1', TestStub)
                .registerScoped('Service2', TestStubWithOneDependency, 'Service1');

            expect(builder.count).toBe(2);
        });

        it('should clear all registered services', () => {
            builder
                .registerSingleton('Service1', TestStub)
                .registerScoped('Service2', TestStubWithOneDependency, 'Service1');

            expect(builder.count).toBe(2);

            builder.clear();
            expect(builder.count).toBe(0);
        });
    });

    describe('Validation', () => {
        it('should validate service registrations', () => {
            builder.registerSingleton('ValidService', TestStub);

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should detect missing dependencies', () => {
            builder.registerSingleton('ServiceWithMissingDep', TestStubWithOneDependency, 'NonExistentService');

            const issues = builder.validate();
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0]).toContain('depends on unregistered service');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid service keys gracefully', () => {
            const container = builder
                .registerSingleton('Logger', ConsoleLogger)
                .buildTypeSafe();

            expect(() => {
                (container as any).get('NonExistentService');
            }).toThrow('No service registered for key');
        });

        it('should prevent building empty containers with warning', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            const container = builder.buildTypeSafe();
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Building ServiceProvider with no registered services')
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('Lifecycle Management', () => {
        it('should resolve singleton services consistently', () => {
            const container = builder
                .registerSingleton('Logger', ConsoleLogger)
                .buildTypeSafe();

            const logger1 = container.get('Logger');
            const logger2 = container.get('Logger');

            expect(logger1).toBe(logger2); // Same instance
        });

        it('should resolve scoped services within same scope', () => {
            const container = builder
                .registerScopedInterface<ILogger>('ILogger', ConsoleLogger)
                .buildTypeSafe();

            const scope = container.startScope();
            const logger1 = scope.get('ILogger');
            const logger2 = scope.get('ILogger');

            expect(logger1).toBe(logger2); // Same instance within scope
        });

        it('should resolve different instances in different scopes', () => {
            const container = builder
                .registerScopedInterface<ILogger>('ILogger', ConsoleLogger)
                .buildTypeSafe();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const logger1 = scope1.get('ILogger');
            const logger2 = scope2.get('ILogger');

            expect(logger1).not.toBe(logger2); // Different instances
        });
    });
});
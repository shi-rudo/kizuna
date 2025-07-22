/**
 * Type-Safe Fluent API Tests
 * Tests for enhanced FluentContainerBuilder with type-safe key tracking
 */
import { describe, expect, it } from 'vitest';
import { FluentContainerBuilder } from '../src/api/fluent-container-builder';
import { TestStub, TestStubWithOneDependency } from './test-dummies';

// Test services
class ConsoleLogger {
    public messages: string[] = [];
    
    log(message: string): void {
        this.messages.push(message);
        console.log(`[LOG]: ${message}`);
    }
}

class DatabaseService {
    constructor(private logger: ConsoleLogger) {}
    
    query(sql: string): any[] {
        this.logger.log(`Executing: ${sql}`);
        return [{ id: 1, result: 'data' }];
    }
}

describe('Type-Safe Fluent API', () => {
    describe('Type-Safe Registration Methods', () => {
        it('should register singleton services with type-safe keys', () => {
            const container = new FluentContainerBuilder()
                .registerSingleton('Logger', ConsoleLogger)
                .registerSingleton('Database', DatabaseService, 'Logger')
                .build();

            const logger = container.get('Logger');
            const database = container.get('Database');

            expect(logger).toBeInstanceOf(ConsoleLogger);
            expect(database).toBeInstanceOf(DatabaseService);
        });

        it('should register scoped services with type-safe keys', () => {
            const container = new FluentContainerBuilder()
                .registerSingleton('Logger', ConsoleLogger)
                .registerScoped('Database', DatabaseService, 'Logger')
                .build();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const db1 = scope1.get('Database');
            const db2 = scope2.get('Database');

            expect(db1).toBeInstanceOf(DatabaseService);
            expect(db2).toBeInstanceOf(DatabaseService);
            expect(db1).not.toBe(db2); // Different instances
        });

        it('should register transient services with type-safe keys', () => {
            const container = new FluentContainerBuilder()
                .registerTransient('Service', TestStub)
                .build();

            const service1 = container.get('Service');
            const service2 = container.get('Service');

            expect(service1).toBeInstanceOf(TestStub);
            expect(service2).toBeInstanceOf(TestStub);
            expect(service1).not.toBe(service2); // Different instances
        });

        it('should support factory functions with type-safe keys', () => {
            const container = new FluentContainerBuilder()
                .registerSingleton('Logger', ConsoleLogger)
                .registerFactory('CustomService', (provider) => {
                    const logger = provider.get<ConsoleLogger>('Logger');
                    return new DatabaseService(logger);
                })
                .build();

            const service = container.get('CustomService');
            expect(service).toBeInstanceOf(DatabaseService);
        });
    });

    describe('Mixed Registration Patterns', () => {
        it('should allow mixing different registration methods', () => {
            const container = new FluentContainerBuilder()
                .registerSingleton('TestStub', TestStub)
                .registerSingleton('Logger', ConsoleLogger)
                .registerScoped('Database', DatabaseService, 'Logger')
                .build();

            const testStub = container.get('TestStub');
            const logger = container.get('Logger');
            const database = container.get('Database');

            expect(testStub).toBeInstanceOf(TestStub);
            expect(logger).toBeInstanceOf(ConsoleLogger);
            expect(database).toBeInstanceOf(DatabaseService);
        });
    });

    describe('Factory Registration Features', () => {
        it('should support factory functions for complex initialization', () => {
            const container = new FluentContainerBuilder()
                .registerSingleton('Logger', ConsoleLogger)
                .registerFactory('ComplexService', (provider) => {
                    // Type-safe provider access - no explicit generic needed!
                    const logger = provider.get('Logger'); // Type: ConsoleLogger
                    logger.log('Creating complex service');
                    return new DatabaseService(logger);
                })
                .build();

            const service = container.get('ComplexService');
            const logger = container.get('Logger') as ConsoleLogger;

            expect(service).toBeInstanceOf(DatabaseService);
            expect(logger.messages).toContain('Creating complex service');
        });
    });
});
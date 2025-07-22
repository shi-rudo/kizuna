/**
 * Unified ContainerBuilder Tests
 * 
 * Comprehensive tests for the unified ContainerBuilder that supports:
 * - Constructor-based registration (singleton, scoped, transient)
 * - Interface-based registration (singleton, scoped, transient)  
 * - Factory-based registration (singleton, scoped, transient)
 * - Full type safety and lifecycle management
 * - Validation and error handling
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

// Test dummies
class TestService {
    private value = Math.random();
    getValue() { return this.value; }
    doSomething() { return 'TestService doSomething'; }
}

class ServiceWithDependency {
    constructor(public dependency: TestService) {}
    doSomething() { return `ServiceWithDependency: ${this.dependency.doSomething()}`; }
}

class ServiceWithMultipleDependencies {
    constructor(
        public dep1: TestService,
        public dep2: ServiceWithDependency
    ) {}
    doSomething() { 
        return `MultiDep: ${this.dep1.doSomething()} + ${this.dep2.doSomething()}`;
    }
}

// Interface-based test services
interface ILogger {
    log(message: string): void;
    getMessages(): string[];
}

class ConsoleLogger implements ILogger {
    private messages: string[] = [];
    
    log(message: string): void {
        this.messages.push(message);
    }
    
    getMessages(): string[] {
        return [...this.messages];
    }
}

interface IDatabase {
    query(sql: string): any[];
}

class PostgreSQLDatabase implements IDatabase {
    constructor(private logger: ILogger) {}
    
    query(sql: string): any[] {
        this.logger.log(`Executing: ${sql}`);
        return [{ id: 1, data: 'result' }];
    }
}

describe('ContainerBuilder - Unified API', () => {
    let builder: ContainerBuilder;

    beforeEach(() => {
        builder = new ContainerBuilder();
    });

    describe('Constructor-Based Registration', () => {
        describe('Singleton Services', () => {
            it('should register and resolve singleton services', () => {
                const container = builder
                    .registerSingleton('TestService', TestService)
                    .build();

                const service1 = container.get('TestService');
                const service2 = container.get('TestService');

                expect(service1).toBeInstanceOf(TestService);
                expect(service1).toBe(service2); // Same instance
                expect(service1.getValue()).toBe(service2.getValue());
            });

            it('should handle singleton dependencies', () => {
                const container = builder
                    .registerSingleton('TestService', TestService)
                    .registerSingleton('ServiceWithDep', ServiceWithDependency, 'TestService')
                    .build();

                const service = container.get('ServiceWithDep');
                expect(service).toBeInstanceOf(ServiceWithDependency);
                expect(service.dependency).toBeInstanceOf(TestService);
            });

            it('should handle multiple dependencies', () => {
                const container = builder
                    .registerSingleton('TestService', TestService)
                    .registerSingleton('ServiceWithDep', ServiceWithDependency, 'TestService')
                    .registerSingleton('MultiDep', ServiceWithMultipleDependencies, 'TestService', 'ServiceWithDep')
                    .build();

                const service = container.get('MultiDep');
                expect(service).toBeInstanceOf(ServiceWithMultipleDependencies);
                expect(service.dep1).toBeInstanceOf(TestService);
                expect(service.dep2).toBeInstanceOf(ServiceWithDependency);
                
                const result = service.doSomething();
                expect(result).toContain('TestService doSomething');
                expect(result).toContain('ServiceWithDependency');
            });
        });

        describe('Scoped Services', () => {
            it('should create same instance within scope', () => {
                const container = builder
                    .registerScoped('TestService', TestService)
                    .build();

                const scope = container.startScope();
                const service1 = scope.get('TestService');
                const service2 = scope.get('TestService');

                expect(service1).toBe(service2); // Same instance within scope
                expect(service1.getValue()).toBe(service2.getValue());
            });

            it('should create different instances in different scopes', () => {
                const container = builder
                    .registerScoped('TestService', TestService)
                    .build();

                const scope1 = container.startScope();
                const scope2 = container.startScope();

                const service1 = scope1.get('TestService');
                const service2 = scope2.get('TestService');

                expect(service1).not.toBe(service2); // Different instances
                expect(service1.getValue()).not.toBe(service2.getValue());
            });

            it('should handle mixed singleton and scoped dependencies', () => {
                const container = builder
                    .registerSingleton('TestService', TestService)
                    .registerScoped('ServiceWithDep', ServiceWithDependency, 'TestService')
                    .build();

                const scope1 = container.startScope();
                const scope2 = container.startScope();

                const scoped1 = scope1.get('ServiceWithDep');
                const scoped2 = scope2.get('ServiceWithDep');
                
                expect(scoped1).not.toBe(scoped2); // Different scoped instances
                expect(scoped1.dependency).toBe(scoped2.dependency); // Same singleton dependency
            });
        });

        describe('Transient Services', () => {
            it('should create new instance on each request', () => {
                const container = builder
                    .registerTransient('TestService', TestService)
                    .build();

                const service1 = container.get('TestService');
                const service2 = container.get('TestService');

                expect(service1).not.toBe(service2); // Different instances
                expect(service1.getValue()).not.toBe(service2.getValue());
            });

            it('should create new instances even within same scope', () => {
                const container = builder
                    .registerTransient('TestService', TestService)
                    .build();

                const scope = container.startScope();
                const service1 = scope.get('TestService');
                const service2 = scope.get('TestService');

                expect(service1).not.toBe(service2); // Always new instances
                expect(service1.getValue()).not.toBe(service2.getValue());
            });
        });
    });

    describe('Interface-Based Registration', () => {
        it('should register and resolve interface implementations', () => {
            const container = builder
                .registerInterface<ILogger>('ILogger', ConsoleLogger)
                .registerInterface<IDatabase>('IDatabase', PostgreSQLDatabase, 'ILogger')
                .build();

            const logger = container.get('ILogger');
            const database = container.get('IDatabase');

            expect(logger).toBeInstanceOf(ConsoleLogger);
            expect(database).toBeInstanceOf(PostgreSQLDatabase);

            // Test functionality
            logger.log('Test message');
            const result = database.query('SELECT * FROM test');
            
            expect(logger.getMessages()).toContain('Test message');
            expect(logger.getMessages()).toContain('Executing: SELECT * FROM test');
            expect(result).toEqual([{ id: 1, data: 'result' }]);
        });

        it('should handle scoped interface registrations', () => {
            const container = builder
                .registerInterface<ILogger>('ILogger', ConsoleLogger)
                .registerScopedInterface<IDatabase>('IDatabase', PostgreSQLDatabase, 'ILogger')
                .build();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const db1 = scope1.get('IDatabase');
            const db2 = scope2.get('IDatabase');
            const logger1 = scope1.get('ILogger');
            const logger2 = scope2.get('ILogger');

            expect(db1).not.toBe(db2); // Different scoped instances
            expect(logger1).toBe(logger2); // Same singleton instance
        });

        it('should handle transient interface registrations', () => {
            const container = builder
                .registerTransientInterface<ILogger>('ILogger', ConsoleLogger)
                .build();

            const logger1 = container.get('ILogger');
            const logger2 = container.get('ILogger');

            expect(logger1).not.toBe(logger2); // Different instances
            expect(logger1).toBeInstanceOf(ConsoleLogger);
            expect(logger2).toBeInstanceOf(ConsoleLogger);
        });
    });

    describe('Factory-Based Registration', () => {
        it('should register and resolve factory services', () => {
            const container = builder
                .registerSingleton('TestService', TestService)
                .registerFactory('Config', (provider) => {
                    const testService = provider.get('TestService');
                    return {
                        env: 'test',
                        testValue: testService.getValue(),
                        created: Date.now()
                    };
                })
                .build();

            const config1 = container.get('Config');
            const config2 = container.get('Config');

            expect(config1).toBe(config2); // Singleton factory
            expect(config1.env).toBe('test');
            expect(typeof config1.testValue).toBe('number');
            expect(typeof config1.created).toBe('number');
        });

        it('should provide type-safe access to registered services in factory', () => {
            const container = builder
                .registerInterface<ILogger>('ILogger', ConsoleLogger)
                .registerFactory('LoggedConfig', (provider) => {
                    const logger = provider.get('ILogger'); // Should be typed as ILogger
                    logger.log('Creating config');
                    return {
                        environment: 'production',
                        debug: false
                    };
                })
                .build();

            const config = container.get('LoggedConfig');
            const logger = container.get('ILogger');

            expect(config.environment).toBe('production');
            expect(config.debug).toBe(false);
            expect(logger.getMessages()).toContain('Creating config');
        });

        it('should handle scoped factory registrations', () => {
            const container = builder
                .registerScopedFactory('RequestContext', () => ({
                    id: Math.random(),
                    timestamp: Date.now()
                }))
                .build();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const ctx1a = scope1.get('RequestContext');
            const ctx1b = scope1.get('RequestContext');
            const ctx2 = scope2.get('RequestContext');

            expect(ctx1a).toBe(ctx1b); // Same within scope
            expect(ctx1a).not.toBe(ctx2); // Different across scopes
            expect(ctx1a.id).not.toBe(ctx2.id);
        });

        it('should handle transient factory registrations', () => {
            const container = builder
                .registerTransientFactory('Timestamp', () => Date.now())
                .build();

            const timestamp1 = container.get('Timestamp');
            const timestamp2 = container.get('Timestamp');

            expect(typeof timestamp1).toBe('number');
            expect(typeof timestamp2).toBe('number');
            // They might be the same if called too quickly, but should be separate instances
            expect(timestamp1).toBeCloseTo(timestamp2, -1); // Within reasonable time range
        });
    });

    describe('Mixed Registration Patterns', () => {
        it('should support all registration patterns together', () => {
            interface ICache {
                get(key: string): any;
                set(key: string, value: any): void;
            }

            class MemoryCache implements ICache {
                private data = new Map();
                get(key: string) { return this.data.get(key); }
                set(key: string, value: any) { this.data.set(key, value); }
            }

            const container = builder
                // Constructor-based
                .registerSingleton('Logger', ConsoleLogger)
                .registerScoped('UserService', ServiceWithDependency, 'Logger')
                
                // Interface-based
                .registerInterface<ICache>('ICache', MemoryCache)
                
                // Factory-based
                .registerFactory('AppConfig', (provider) => {
                    const logger = provider.get('Logger');
                    const cache = provider.get('ICache');
                    logger.log('Initializing app config');
                    cache.set('initialized', true);
                    return { 
                        name: 'TestApp', 
                        version: '1.0.0',
                        features: { caching: true }
                    };
                })
                .build();

            const logger = container.get('Logger');
            const userService = container.get('UserService');
            const cache = container.get('ICache');
            const config = container.get('AppConfig');

            expect(logger).toBeInstanceOf(ConsoleLogger);
            expect(userService).toBeInstanceOf(ServiceWithDependency);
            expect(cache).toBeInstanceOf(MemoryCache);
            expect(config.name).toBe('TestApp');
            expect(cache.get('initialized')).toBe(true);
            expect(logger.getMessages()).toContain('Initializing app config');
        });
    });

    describe('Service Management', () => {
        it('should track registration count', () => {
            expect(builder.count).toBe(0);

            builder.registerSingleton('Service1', TestService);
            expect(builder.count).toBe(1);

            builder.registerScoped('Service2', ServiceWithDependency, 'Service1');
            expect(builder.count).toBe(2);

            builder.registerFactory('Service3', () => ({ value: 42 }));
            expect(builder.count).toBe(3);
        });

        it('should check service registration status', () => {
            expect(builder.isRegistered('TestService')).toBe(false);

            builder.registerSingleton('TestService', TestService);
            expect(builder.isRegistered('TestService')).toBe(true);
        });

        it('should clear all registrations', () => {
            builder
                .registerSingleton('Service1', TestService)
                .registerScoped('Service2', ServiceWithDependency, 'Service1');

            expect(builder.count).toBe(2);

            builder.clear();
            expect(builder.count).toBe(0);
            expect(builder.isRegistered('Service1')).toBe(false);
            expect(builder.isRegistered('Service2')).toBe(false);
        });

        it('should prevent building twice', () => {
            builder.registerSingleton('TestService', TestService);
            
            const container1 = builder.build();
            expect(container1).toBeDefined();

            expect(() => builder.build()).toThrow('Cannot modify ContainerBuilder after it has been built');
        });

        it('should prevent modifications after building', () => {
            builder.registerSingleton('TestService', TestService);
            builder.build();

            expect(() => builder.registerSingleton('Another', TestService)).toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should handle empty service names', () => {
            expect(() => {
                builder.registerSingleton('', TestService);
            }).toThrow();
        });

        it('should handle missing dependencies gracefully during resolution', () => {
            const container = builder
                .registerSingleton('ServiceWithMissingDep', ServiceWithDependency, 'NonExistentService')
                .build();

            expect(() => container.get('ServiceWithMissingDep')).toThrow();
        });
    });

    describe('Scope Management', () => {
        it('should properly dispose scopes', () => {
            const container = builder
                .registerScoped('TestService', TestService)
                .build();

            const scope = container.startScope();
            const service = scope.get('TestService');

            expect(service).toBeInstanceOf(TestService);
            
            scope.dispose(); // Should not throw
        });

        it('should handle container disposal', () => {
            const container = builder
                .registerSingleton('TestService', TestService)
                .build();

            const service = container.get('TestService');
            expect(service).toBeInstanceOf(TestService);

            container.dispose(); // Should not throw
        });
    });
});
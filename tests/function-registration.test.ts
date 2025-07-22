/**
 * Comprehensive Function Registration Tests for ContainerBuilder
 * 
 * Tests all aspects of registering functions as services including:
 * - Different return types (primitives, objects, arrays, functions, promises)
 * - Different lifecycle patterns (singleton, scoped, transient)
 * - Error handling and edge cases
 * - Type safety and complex scenarios
 * - Performance and integration patterns
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

describe('ContainerBuilder - Function Registration', () => {
    let builder: ContainerBuilder;

    beforeEach(() => {
        builder = new ContainerBuilder();
    });

    describe('Primitive Return Types', () => {
        it('should register and resolve factory functions returning strings', () => {
            const container = builder
                .registerFactory('Environment', () => 'production')
                .registerFactory('DatabaseUrl', () => 'postgresql://localhost:5432/app')
                .build();

            const env = container.get('Environment');
            const dbUrl = container.get('DatabaseUrl');

            expect(env).toBe('production');
            expect(dbUrl).toBe('postgresql://localhost:5432/app');
            expect(typeof env).toBe('string');
            expect(typeof dbUrl).toBe('string');
        });

        it('should register and resolve factory functions returning numbers', () => {
            const container = builder
                .registerFactory('Port', () => 3000)
                .registerFactory('MaxConnections', () => 100)
                .registerFactory('Version', () => 1.2)
                .build();

            const port = container.get('Port');
            const maxConn = container.get('MaxConnections');
            const version = container.get('Version');

            expect(port).toBe(3000);
            expect(maxConn).toBe(100);
            expect(version).toBe(1.2);
            expect(typeof port).toBe('number');
            expect(typeof maxConn).toBe('number');
            expect(typeof version).toBe('number');
        });

        it('should register and resolve factory functions returning booleans', () => {
            const container = builder
                .registerFactory('IsProduction', () => true)
                .registerFactory('EnableLogging', () => false)
                .registerFactory('FeatureFlag', () => Math.random() > 0.5)
                .build();

            const isProd = container.get('IsProduction');
            const enableLogging = container.get('EnableLogging');
            const featureFlag = container.get('FeatureFlag');

            expect(isProd).toBe(true);
            expect(enableLogging).toBe(false);
            expect(typeof isProd).toBe('boolean');
            expect(typeof enableLogging).toBe('boolean');
            expect(typeof featureFlag).toBe('boolean');
        });

        it('should register and resolve factory functions returning null/undefined', () => {
            const container = builder
                .registerFactory('NullValue', () => null)
                .registerFactory('UndefinedValue', () => undefined)
                .build();

            const nullVal = container.get('NullValue');
            const undefinedVal = container.get('UndefinedValue');

            expect(nullVal).toBeNull();
            expect(undefinedVal).toBeUndefined();
        });
    });

    describe('Collection Return Types', () => {
        it('should register and resolve factory functions returning arrays', () => {
            const container = builder
                .registerFactory('Numbers', () => [1, 2, 3, 4, 5])
                .registerFactory('Strings', () => ['apple', 'banana', 'cherry'])
                .registerFactory('Mixed', () => [1, 'two', true, null])
                .build();

            const numbers = container.get('Numbers');
            const strings = container.get('Strings');
            const mixed = container.get('Mixed');

            expect(numbers).toEqual([1, 2, 3, 4, 5]);
            expect(strings).toEqual(['apple', 'banana', 'cherry']);
            expect(mixed).toEqual([1, 'two', true, null]);
            expect(Array.isArray(numbers)).toBe(true);
            expect(Array.isArray(strings)).toBe(true);
            expect(Array.isArray(mixed)).toBe(true);
        });

        it('should register and resolve factory functions returning Maps and Sets', () => {
            const container = builder
                .registerFactory('UserMap', () => new Map([['john', 25], ['jane', 30]]))
                .registerFactory('TagSet', () => new Set(['tag1', 'tag2', 'tag3']))
                .build();

            const userMap = container.get('UserMap');
            const tagSet = container.get('TagSet');

            expect(userMap).toBeInstanceOf(Map);
            expect(tagSet).toBeInstanceOf(Set);
            expect(userMap.get('john')).toBe(25);
            expect(tagSet.has('tag1')).toBe(true);
            expect(userMap.size).toBe(2);
            expect(tagSet.size).toBe(3);
        });
    });

    describe('Function Return Types', () => {
        it('should register and resolve factory functions returning callback functions', () => {
            const container = builder
                .registerFactory('Logger', () => (message: string) => console.log(`LOG: ${message}`))
                .registerFactory('Validator', () => (value: any) => value != null && value !== '')
                .registerFactory('Formatter', () => (num: number) => `$${num.toFixed(2)}`)
                .build();

            const logger = container.get('Logger');
            const validator = container.get('Validator');
            const formatter = container.get('Formatter');

            expect(typeof logger).toBe('function');
            expect(typeof validator).toBe('function');
            expect(typeof formatter).toBe('function');
            
            expect(validator('test')).toBe(true);
            expect(validator('')).toBe(false);
            expect(formatter(123.456)).toBe('$123.46');
        });

        it('should register and resolve factory functions returning arrow functions', () => {
            const container = builder
                .registerFactory('Adder', () => (a: number, b: number) => a + b)
                .registerFactory('StringUtils', () => ({
                    upper: (str: string) => str.toUpperCase(),
                    lower: (str: string) => str.toLowerCase(),
                    reverse: (str: string) => str.split('').reverse().join('')
                }))
                .build();

            const adder = container.get('Adder');
            const stringUtils = container.get('StringUtils');

            expect(typeof adder).toBe('function');
            expect(adder(2, 3)).toBe(5);
            expect(stringUtils.upper('hello')).toBe('HELLO');
            expect(stringUtils.reverse('abc')).toBe('cba');
        });
    });

    describe('Complex Object Return Types', () => {
        it('should register factory functions returning complex nested objects', () => {
            interface DatabaseConfig {
                host: string;
                port: number;
                credentials: {
                    username: string;
                    password: string;
                };
                options: {
                    ssl: boolean;
                    timeout: number;
                    retry: {
                        attempts: number;
                        delay: number;
                    };
                };
            }

            const container = builder
                .registerFactory('DatabaseConfig', (): DatabaseConfig => ({
                    host: 'localhost',
                    port: 5432,
                    credentials: {
                        username: 'admin',
                        password: 'secret123'
                    },
                    options: {
                        ssl: true,
                        timeout: 30000,
                        retry: {
                            attempts: 3,
                            delay: 1000
                        }
                    }
                }))
                .build();

            const config = container.get('DatabaseConfig');
            
            expect(config.host).toBe('localhost');
            expect(config.port).toBe(5432);
            expect(config.credentials.username).toBe('admin');
            expect(config.options.ssl).toBe(true);
            expect(config.options.retry.attempts).toBe(3);
        });

        it('should register factory functions returning objects with methods', () => {
            const container = builder
                .registerFactory('Calculator', () => ({
                    add: (a: number, b: number) => a + b,
                    subtract: (a: number, b: number) => a - b,
                    multiply: (a: number, b: number) => a * b,
                    divide: (a: number, b: number) => b !== 0 ? a / b : NaN,
                    history: [] as string[],
                    recordOperation: function(operation: string) {
                        this.history.push(operation);
                    }
                }))
                .build();

            const calc = container.get('Calculator');
            
            expect(calc.add(5, 3)).toBe(8);
            expect(calc.subtract(10, 4)).toBe(6);
            expect(calc.multiply(3, 4)).toBe(12);
            expect(calc.divide(8, 2)).toBe(4);
            expect(calc.divide(8, 0)).toBeNaN();
            
            calc.recordOperation('add(5,3)');
            expect(calc.history).toContain('add(5,3)');
        });
    });

    describe('Lifecycle Patterns for Functions', () => {
        it('should handle singleton factory functions correctly', () => {
            let creationCount = 0;
            
            const container = builder
                .registerFactory('Counter', () => {
                    creationCount++;
                    return { value: creationCount, timestamp: Date.now() };
                })
                .build();

            const counter1 = container.get('Counter');
            const counter2 = container.get('Counter');
            const counter3 = container.get('Counter');

            expect(creationCount).toBe(1); // Factory called only once
            expect(counter1).toBe(counter2); // Same instance
            expect(counter2).toBe(counter3); // Same instance
            expect(counter1.value).toBe(1);
        });

        it('should handle scoped factory functions correctly', () => {
            let creationCount = 0;
            
            const container = builder
                .registerScopedFactory('ScopedCounter', () => {
                    creationCount++;
                    return { value: creationCount, id: Math.random() };
                })
                .build();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const counter1a = scope1.get('ScopedCounter');
            const counter1b = scope1.get('ScopedCounter');
            const counter2a = scope2.get('ScopedCounter');

            expect(creationCount).toBe(2); // Called once per scope
            expect(counter1a).toBe(counter1b); // Same within scope
            expect(counter1a).not.toBe(counter2a); // Different across scopes
            expect(counter1a.id).toBe(counter1b.id);
            expect(counter1a.id).not.toBe(counter2a.id);
        });

        it('should handle transient factory functions correctly', () => {
            let creationCount = 0;
            
            const container = builder
                .registerTransientFactory('TransientCounter', () => {
                    creationCount++;
                    return { value: creationCount, id: Math.random() };
                })
                .build();

            const counter1 = container.get('TransientCounter');
            const counter2 = container.get('TransientCounter');
            const counter3 = container.get('TransientCounter');

            expect(creationCount).toBe(3); // Called every time
            expect(counter1).not.toBe(counter2); // Different instances
            expect(counter2).not.toBe(counter3); // Different instances
            expect(counter1.value).toBe(1);
            expect(counter2.value).toBe(2);
            expect(counter3.value).toBe(3);
        });

        it('should handle mixed lifecycle factory functions', () => {
            let singletonCount = 0;
            let scopedCount = 0;
            let transientCount = 0;

            const container = builder
                .registerFactory('SingletonService', () => {
                    singletonCount++;
                    return { type: 'singleton', count: singletonCount };
                })
                .registerScopedFactory('ScopedService', () => {
                    scopedCount++;
                    return { type: 'scoped', count: scopedCount };
                })
                .registerTransientFactory('TransientService', () => {
                    transientCount++;
                    return { type: 'transient', count: transientCount };
                })
                .build();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            // Get services multiple times in different scopes
            const singleton1 = scope1.get('SingletonService');
            const scoped1 = scope1.get('ScopedService');
            const transient1 = scope1.get('TransientService');
            
            const singleton2 = scope2.get('SingletonService');
            const scoped2 = scope2.get('ScopedService');
            const transient2 = scope2.get('TransientService');

            const transient3 = scope1.get('TransientService');

            expect(singletonCount).toBe(1); // Singleton called once
            expect(scopedCount).toBe(2); // Scoped called once per scope
            expect(transientCount).toBe(3); // Transient called every time

            expect(singleton1).toBe(singleton2); // Same singleton
            expect(scoped1).not.toBe(scoped2); // Different scoped per scope
            expect(transient1).not.toBe(transient2); // Different transient
            expect(transient1).not.toBe(transient3); // Different transient
        });
    });

    describe('Provider-Dependent Factory Functions', () => {
        it('should provide type-safe access to registered services in factories', () => {
            class Logger {
                private messages: string[] = [];
                log(message: string) { this.messages.push(message); }
                getMessages() { return [...this.messages]; }
            }

            const container = builder
                .registerSingleton('Logger', Logger)
                .registerFactory('ConfigService', (provider) => {
                    const logger = provider.get('Logger'); // Should be typed as Logger
                    logger.log('Creating configuration service');
                    
                    return {
                        environment: 'production',
                        features: {
                            logging: true,
                            metrics: false
                        },
                        getConfig: (key: string) => {
                            logger.log(`Accessing config key: ${key}`);
                            return `value-for-${key}`;
                        }
                    };
                })
                .build();

            const configService = container.get('ConfigService');
            const logger = container.get('Logger');

            expect(configService.environment).toBe('production');
            expect(logger.getMessages()).toContain('Creating configuration service');

            const value = configService.getConfig('database-url');
            expect(value).toBe('value-for-database-url');
            expect(logger.getMessages()).toContain('Accessing config key: database-url');
        });

        it('should handle complex provider dependencies in factories', () => {
            interface ICache {
                get(key: string): any;
                set(key: string, value: any): void;
            }

            class MemoryCache implements ICache {
                private store = new Map();
                get(key: string) { return this.store.get(key); }
                set(key: string, value: any) { this.store.set(key, value); }
            }

            class DatabaseService {
                query(sql: string) { return [{ id: 1, name: 'test' }]; }
            }

            const container = builder
                .registerInterface<ICache>('ICache', MemoryCache)
                .registerSingleton('DatabaseService', DatabaseService)
                .registerFactory('UserRepository', (provider) => {
                    const cache = provider.get('ICache');
                    const db = provider.get('DatabaseService');
                    
                    return {
                        findUser: (id: string) => {
                            const cacheKey = `user:${id}`;
                            let user = cache.get(cacheKey);
                            
                            if (!user) {
                                user = db.query(`SELECT * FROM users WHERE id = '${id}'`)[0];
                                cache.set(cacheKey, user);
                            }
                            
                            return user;
                        },
                        createUser: (userData: any) => {
                            const result = db.query(`INSERT INTO users...`);
                            cache.set(`user:${userData.id}`, userData);
                            return result;
                        }
                    };
                })
                .build();

            const userRepo = container.get('UserRepository');
            const cache = container.get('ICache');

            const user = userRepo.findUser('123');
            expect(user).toEqual({ id: 1, name: 'test' });
            
            // Check that user was cached
            const cachedUser = cache.get('user:123');
            expect(cachedUser).toEqual(user);
        });

        it('should handle deeply nested provider service access', () => {
            const container = builder
                .registerFactory('Level1', () => ({ value: 1, name: 'level1' }))
                .registerFactory('Level2', (provider) => {
                    const level1 = provider.get('Level1');
                    return { value: level1.value + 1, name: 'level2', parent: level1 };
                })
                .registerFactory('Level3', (provider) => {
                    const level1 = provider.get('Level1');
                    const level2 = provider.get('Level2');
                    return { 
                        value: level2.value + 1, 
                        name: 'level3', 
                        parents: [level1, level2],
                        total: level1.value + level2.value + 3
                    };
                })
                .build();

            const level3 = container.get('Level3');
            
            expect(level3.value).toBe(3);
            expect(level3.name).toBe('level3');
            expect(level3.parents).toHaveLength(2);
            expect(level3.parents[0].name).toBe('level1');
            expect(level3.parents[1].name).toBe('level2');
            expect(level3.total).toBe(6); // 1 + 2 + 3
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle factory functions that throw errors during creation', () => {
            const container = builder
                .registerFactory('FailingService', () => {
                    throw new Error('Service creation failed');
                })
                .build();

            expect(() => container.get('FailingService')).toThrow('Service creation failed');
        });

        it('should handle factory functions with conditional errors', () => {
            let shouldFail = false;

            const container = builder
                .registerTransientFactory('ConditionalService', () => {
                    if (shouldFail) {
                        throw new Error('Conditional failure');
                    }
                    return { success: true };
                })
                .build();

            // First call succeeds
            const service1 = container.get('ConditionalService');
            expect(service1.success).toBe(true);

            // Enable failure
            shouldFail = true;

            // Second call fails
            expect(() => container.get('ConditionalService')).toThrow('Conditional failure');

            // Disable failure
            shouldFail = false;

            // Third call succeeds again
            const service3 = container.get('ConditionalService');
            expect(service3.success).toBe(true);
        });

        it('should handle factory functions accessing non-existent services', () => {
            const container = builder
                .registerFactory('ServiceWithMissingDep', (provider) => {
                    // Cast to any to bypass type checking for this error test
                    const missing = (provider as any).get('NonExistentService');
                    return { dependency: missing };
                })
                .build();

            expect(() => container.get('ServiceWithMissingDep')).toThrow();
        });

        it('should handle factory functions with invalid return types', () => {
            // Test registering a factory that doesn't return anything
            const container = builder
                .registerFactory('VoidService', () => {
                    console.log('This factory returns undefined');
                    // No return statement - implicitly returns undefined
                })
                .build();

            const service = container.get('VoidService');
            expect(service).toBeUndefined();
        });
    });

    describe('Performance and Memory Considerations', () => {
        it('should handle factory functions with expensive computations', () => {
            let computationCount = 0;
            
            const container = builder
                .registerFactory('ExpensiveComputation', () => {
                    computationCount++;
                    
                    // Simulate expensive computation
                    let result = 0;
                    for (let i = 0; i < 1000; i++) {
                        result += Math.random();
                    }
                    
                    return {
                        result,
                        computationNumber: computationCount,
                        timestamp: Date.now()
                    };
                })
                .build();

            const start = Date.now();
            const computation1 = container.get('ExpensiveComputation');
            const computation2 = container.get('ExpensiveComputation');
            const end = Date.now();

            // Singleton behavior - expensive computation only done once
            expect(computationCount).toBe(1);
            expect(computation1).toBe(computation2); // Same instance
            expect(computation1.computationNumber).toBe(1);
            
            // Should be relatively fast for second call due to singleton caching
            expect(end - start).toBeLessThan(1000); // Should complete in reasonable time
        });

        it('should handle factory functions creating large objects', () => {
            const container = builder
                .registerFactory('LargeDataset', () => {
                    return {
                        data: Array.from({ length: 10000 }, (_, i) => ({
                            id: i,
                            name: `Item ${i}`,
                            value: Math.random(),
                            metadata: {
                                created: new Date(),
                                tags: [`tag${i % 10}`, `category${i % 5}`]
                            }
                        })),
                        size: 10000,
                        index: new Map()
                    };
                })
                .build();

            const dataset = container.get('LargeDataset');
            
            expect(dataset.data).toHaveLength(10000);
            expect(dataset.size).toBe(10000);
            expect(dataset.data[0].id).toBe(0);
            expect(dataset.data[9999].id).toBe(9999);
            expect(Array.isArray(dataset.data[0].metadata.tags)).toBe(true);
        });

        it('should handle multiple factory functions with shared expensive dependencies', () => {
            let sharedResourceCreationCount = 0;
            
            const container = builder
                .registerFactory('SharedResource', () => {
                    sharedResourceCreationCount++;
                    return {
                        id: `resource-${sharedResourceCreationCount}`,
                        data: Array.from({ length: 1000 }, (_, i) => i),
                        createdAt: Date.now()
                    };
                })
                .registerFactory('Service1', (provider) => {
                    const resource = provider.get('SharedResource');
                    return {
                        name: 'Service1',
                        resourceId: resource.id,
                        processedData: resource.data.slice(0, 100)
                    };
                })
                .registerFactory('Service2', (provider) => {
                    const resource = provider.get('SharedResource');
                    return {
                        name: 'Service2',
                        resourceId: resource.id,
                        processedData: resource.data.slice(500, 600)
                    };
                })
                .build();

            const service1 = container.get('Service1');
            const service2 = container.get('Service2');
            const sharedResource = container.get('SharedResource');

            // Shared resource should only be created once
            expect(sharedResourceCreationCount).toBe(1);
            expect(service1.resourceId).toBe(service2.resourceId);
            expect(service1.resourceId).toBe(sharedResource.id);
            expect(service1.processedData).toHaveLength(100);
            expect(service2.processedData).toHaveLength(100);
        });
    });

    describe('Advanced Factory Function Scenarios', () => {
        it('should handle factory functions that return promises', () => {
            const container = builder
                .registerFactory('AsyncConfig', () => Promise.resolve({
                    environment: 'production',
                    loaded: true
                }))
                .build();

            const asyncConfig = container.get('AsyncConfig');
            expect(asyncConfig).toBeInstanceOf(Promise);
            
            return asyncConfig.then(config => {
                expect(config.environment).toBe('production');
                expect(config.loaded).toBe(true);
            });
        });

        it('should handle factory functions with closure state', () => {
            function createCounterFactory(initialValue: number) {
                let count = initialValue;
                
                return () => ({
                    increment: () => ++count,
                    decrement: () => --count,
                    getValue: () => count,
                    reset: () => { count = initialValue; }
                });
            }

            const container = builder
                .registerFactory('Counter1', createCounterFactory(0))
                .registerFactory('Counter2', createCounterFactory(100))
                .build();

            const counter1 = container.get('Counter1');
            const counter2 = container.get('Counter2');

            expect(counter1.getValue()).toBe(0);
            expect(counter2.getValue()).toBe(100);

            counter1.increment();
            counter1.increment();
            counter2.decrement();

            expect(counter1.getValue()).toBe(2);
            expect(counter2.getValue()).toBe(99);

            // Singleton behavior - same instances
            const counter1Again = container.get('Counter1');
            expect(counter1Again.getValue()).toBe(2); // State preserved
        });

        it('should handle factory functions creating event emitters and observables', () => {
            interface EventEmitter {
                on(event: string, listener: (...args: any[]) => void): void;
                emit(event: string, ...args: any[]): void;
                off(event: string, listener: (...args: any[]) => void): void;
            }

            const container = builder
                .registerFactory('EventBus', (): EventEmitter => {
                    const listeners = new Map<string, ((...args: any[]) => void)[]>();
                    
                    return {
                        on(event: string, listener: (...args: any[]) => void) {
                            if (!listeners.has(event)) {
                                listeners.set(event, []);
                            }
                            listeners.get(event)!.push(listener);
                        },
                        
                        emit(event: string, ...args: any[]) {
                            const eventListeners = listeners.get(event) || [];
                            eventListeners.forEach(listener => listener(...args));
                        },
                        
                        off(event: string, listener: (...args: any[]) => void) {
                            const eventListeners = listeners.get(event) || [];
                            const index = eventListeners.indexOf(listener);
                            if (index > -1) {
                                eventListeners.splice(index, 1);
                            }
                        }
                    };
                })
                .build();

            const eventBus = container.get('EventBus');
            const receivedEvents: any[] = [];

            eventBus.on('test-event', (data) => {
                receivedEvents.push(data);
            });

            eventBus.emit('test-event', { message: 'Hello World' });
            eventBus.emit('test-event', { message: 'Second Event' });

            expect(receivedEvents).toHaveLength(2);
            expect(receivedEvents[0].message).toBe('Hello World');
            expect(receivedEvents[1].message).toBe('Second Event');
        });
    });

    describe('Integration with Other Registration Patterns', () => {
        it('should allow factory functions to depend on constructor-registered services', () => {
            class DatabaseService {
                query(sql: string) {
                    return [{ id: 1, data: sql }];
                }
            }

            class Logger {
                log(message: string) {
                    console.log(`[LOG] ${message}`);
                }
            }

            const container = builder
                .registerSingleton('DatabaseService', DatabaseService)
                .registerSingleton('Logger', Logger)
                .registerFactory('UserService', (provider) => {
                    const db = provider.get('DatabaseService');
                    const logger = provider.get('Logger');
                    
                    return {
                        findUser: (id: string) => {
                            logger.log(`Finding user with id: ${id}`);
                            return db.query(`SELECT * FROM users WHERE id = '${id}'`);
                        },
                        createUser: (userData: any) => {
                            logger.log(`Creating user: ${JSON.stringify(userData)}`);
                            return db.query(`INSERT INTO users...`);
                        }
                    };
                })
                .build();

            const userService = container.get('UserService');
            const result = userService.findUser('123');
            
            expect(result).toEqual([{ id: 1, data: "SELECT * FROM users WHERE id = '123'" }]);
        });

        it('should allow constructor-registered services to depend on factory-registered services', () => {
            class EmailService {
                constructor(private config: any) {}
                
                send(to: string, subject: string, body: string) {
                    return `Sent to ${to}: ${subject} (${this.config.environment})`;
                }
            }

            const container = builder
                .registerFactory('EmailConfig', () => ({
                    environment: 'production',
                    smtpHost: 'smtp.example.com',
                    apiKey: 'secret-key'
                }))
                .registerSingleton('EmailService', EmailService, 'EmailConfig')
                .build();

            const emailService = container.get('EmailService');
            const result = emailService.send('test@example.com', 'Test Subject', 'Test Body');
            
            expect(result).toBe('Sent to test@example.com: Test Subject (production)');
        });

        it('should handle complex mixed registration patterns', () => {
            interface ICache {
                get(key: string): any;
                set(key: string, value: any): void;
            }

            class MemoryCache implements ICache {
                private store = new Map();
                get(key: string) { return this.store.get(key); }
                set(key: string, value: any) { this.store.set(key, value); }
            }

            class ApiClient {
                constructor(private config: any, private cache: ICache) {}
                
                get(endpoint: string) {
                    const cacheKey = `api:${endpoint}`;
                    let result = this.cache.get(cacheKey);
                    
                    if (!result) {
                        result = { data: `${this.config.baseUrl}${endpoint}`, timestamp: Date.now() };
                        this.cache.set(cacheKey, result);
                    }
                    
                    return result;
                }
            }

            const container = builder
                // Factory registration
                .registerFactory('ApiConfig', () => ({
                    baseUrl: 'https://api.example.com',
                    timeout: 5000,
                    retries: 3
                }))
                
                // Interface registration
                .registerInterface<ICache>('ICache', MemoryCache)
                
                // Constructor registration depending on both
                .registerSingleton('ApiClient', ApiClient, 'ApiConfig', 'ICache')
                
                // Factory registration depending on constructor service
                .registerFactory('UserRepository', (provider) => {
                    const apiClient = provider.get('ApiClient');
                    
                    return {
                        getUser: (id: string) => apiClient.get(`/users/${id}`),
                        listUsers: () => apiClient.get('/users')
                    };
                })
                
                .build();

            const userRepo = container.get('UserRepository');
            const user = userRepo.getUser('123');
            const usersCached = userRepo.getUser('123'); // Should use cache
            
            expect(user.data).toBe('https://api.example.com/users/123');
            expect(user).toBe(usersCached); // Same cached result
        });
    });
});
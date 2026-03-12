/**
 * Multi-Registration / getAll Feature Tests
 *
 * Tests for registering multiple implementations under one key
 * and resolving them as arrays via getAll() or get().
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

// Test dummies
class HandlerA {
    handle() { return 'A'; }
}
class HandlerB {
    handle() { return 'B'; }
}
class HandlerC {
    handle() { return 'C'; }
}

class AuthMiddleware {
    constructor(public config: AppConfig) {}
    run() { return `auth:${this.config.env}`; }
}

class LoggingMiddleware {
    run() { return 'logging'; }
}

class AppConfig {
    env = 'test';
}

class EmailValidator {
    validate() { return 'email'; }
}
class PhoneValidator {
    validate() { return 'phone'; }
}

describe('Multi-Registration', () => {
    describe('addSingleton', () => {
        it('should register multiple implementations under one key', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .build();

            const handlers = container.getAll('handlers');
            expect(handlers).toHaveLength(2);
            expect(handlers[0]).toBeInstanceOf(HandlerA);
            expect(handlers[1]).toBeInstanceOf(HandlerB);
        });

        it('should return same singleton instances on repeated calls', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .build();

            const first = container.getAll('handlers');
            const second = container.getAll('handlers');
            expect(first[0]).toBe(second[0]);
            expect(first[1]).toBe(second[1]);
        });

        it('should support dependencies', () => {
            const container = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .addSingleton('middleware', AuthMiddleware, 'config')
                .build();

            const middleware = container.getAll('middleware');
            expect(middleware).toHaveLength(1);
            expect(middleware[0]).toBeInstanceOf(AuthMiddleware);
            expect((middleware[0] as AuthMiddleware).config).toBeInstanceOf(AppConfig);
        });
    });

    describe('addScoped', () => {
        it('should create new instances per scope', () => {
            const container = new ContainerBuilder()
                .addScoped('handlers', HandlerA)
                .addScoped('handlers', HandlerB)
                .build();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const handlers1 = scope1.getAll('handlers');
            const handlers2 = scope2.getAll('handlers');

            // Different instances across scopes
            expect(handlers1[0]).not.toBe(handlers2[0]);
            expect(handlers1[1]).not.toBe(handlers2[1]);

            // Same instances within same scope
            const handlers1Again = scope1.getAll('handlers');
            expect(handlers1[0]).toBe(handlers1Again[0]);
            expect(handlers1[1]).toBe(handlers1Again[1]);
        });
    });

    describe('addTransient', () => {
        it('should create new instances on every call', () => {
            const container = new ContainerBuilder()
                .addTransient('validators', EmailValidator)
                .addTransient('validators', PhoneValidator)
                .build();

            const first = container.getAll('validators');
            const second = container.getAll('validators');

            expect(first[0]).not.toBe(second[0]);
            expect(first[1]).not.toBe(second[1]);
            expect(first[0]).toBeInstanceOf(EmailValidator);
            expect(first[1]).toBeInstanceOf(PhoneValidator);
        });
    });

    describe('addSingletonFactory', () => {
        it('should register factory-based multi-services', () => {
            const container = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .addSingletonFactory('middleware', (p) => new AuthMiddleware(p.get('config')))
                .addSingletonFactory('middleware', () => new LoggingMiddleware())
                .build();

            const middleware = container.getAll('middleware');
            expect(middleware).toHaveLength(2);
            expect(middleware[0]).toBeInstanceOf(AuthMiddleware);
            expect(middleware[1]).toBeInstanceOf(LoggingMiddleware);
        });

        it('should return same instances (singleton behavior)', () => {
            const container = new ContainerBuilder()
                .addSingletonFactory('items', () => ({ id: Math.random() }))
                .addSingletonFactory('items', () => ({ id: Math.random() }))
                .build();

            const first = container.getAll('items');
            const second = container.getAll('items');
            expect(first[0]).toBe(second[0]);
            expect(first[1]).toBe(second[1]);
        });
    });

    describe('addScopedFactory', () => {
        it('should create new factory instances per scope', () => {
            const container = new ContainerBuilder()
                .addScopedFactory('ids', () => ({ id: Math.random() }))
                .build();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const ids1 = scope1.getAll('ids');
            const ids2 = scope2.getAll('ids');

            expect(ids1[0]).not.toBe(ids2[0]);
        });
    });

    describe('addTransientFactory', () => {
        it('should create new factory instances every time', () => {
            const container = new ContainerBuilder()
                .addTransientFactory('ids', () => ({ id: Math.random() }))
                .build();

            const first = container.getAll('ids');
            const second = container.getAll('ids');

            expect(first[0]).not.toBe(second[0]);
        });
    });

    describe('get() for multi-keys', () => {
        it('should return array when using get() on a multi-key', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .build();

            const handlers = container.get('handlers');
            expect(Array.isArray(handlers)).toBe(true);
            expect(handlers).toHaveLength(2);
        });
    });

    describe('getAll() on single-keys', () => {
        it('should wrap single-key result in array', () => {
            const container = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .build();

            const result = container.getAll('config');
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(AppConfig);
        });
    });

    describe('mixed registrations', () => {
        it('should support both single and multi registrations', () => {
            const container = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .build();

            const config = container.get('config');
            expect(config).toBeInstanceOf(AppConfig);

            const handlers = container.getAll('handlers');
            expect(handlers).toHaveLength(2);
        });

        it('should handle three implementations', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .addSingleton('handlers', HandlerC)
                .build();

            const handlers = container.getAll('handlers');
            expect(handlers).toHaveLength(3);
            expect(handlers[0]).toBeInstanceOf(HandlerA);
            expect(handlers[1]).toBeInstanceOf(HandlerB);
            expect(handlers[2]).toBeInstanceOf(HandlerC);
        });
    });

    describe('key collision guard', () => {
        it('should throw when using add* on a key already used with register*', () => {
            expect(() => {
                new ContainerBuilder()
                    .registerSingleton('config', AppConfig)
                    .addSingleton('config', HandlerA);
            }).toThrow(/already registered as a single service/);
        });

        it('should throw when using register* on a key already used with add*', () => {
            expect(() => {
                new ContainerBuilder()
                    .addSingleton('handlers', HandlerA)
                    .registerSingleton('handlers', HandlerB);
            }).toThrow(/already registered as a multi-service/);
        });
    });

    describe('validation', () => {
        it('should validate multi-registration dependencies', () => {
            const builder = new ContainerBuilder()
                .addSingleton('middleware', AuthMiddleware, 'missingDep');

            const issues = builder.validate();
            expect(issues.some(i => i.includes('missingDep'))).toBe(true);
        });

        it('should detect circular dependency involving multi-registrations', () => {
            // DepA depends on 'handlers', handlers depend on 'DepA' → cycle
            class DepA {
                constructor(public handlers: any) {}
            }
            class HandlerX {
                constructor(public depA: DepA) {}
            }

            const builder = new ContainerBuilder()
                .registerSingleton('DepA', DepA, 'handlers')
                .addSingleton('handlers', HandlerX, 'DepA');

            const issues = builder.validate();
            const circularIssues = issues.filter(i => i.toLowerCase().includes('circular'));
            expect(circularIssues.length).toBeGreaterThan(0);
            expect(circularIssues[0]).toContain('DepA');
            expect(circularIssues[0]).toContain('handlers');
        });

        it('should detect circular dependency purely within multi-registrations', () => {
            class ServiceX {
                constructor(public y: any) {}
            }
            class ServiceY {
                constructor(public x: any) {}
            }

            const builder = new ContainerBuilder()
                .addSingleton('groupX', ServiceX, 'groupY')
                .addSingleton('groupY', ServiceY, 'groupX');

            const issues = builder.validate();
            const circularIssues = issues.filter(i => i.toLowerCase().includes('circular'));
            expect(circularIssues.length).toBeGreaterThan(0);
        });
    });

    describe('builder state', () => {
        it('should include multi-registrations in count', () => {
            const builder = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB);

            // config + handlers = 2 registered service names
            expect(builder.count).toBe(2);
        });

        it('should report multi-keys as registered', () => {
            const builder = new ContainerBuilder()
                .addSingleton('handlers', HandlerA);

            expect(builder.isRegistered('handlers')).toBe(true);
        });

        it('should clear multi-registrations', () => {
            const builder = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB);

            builder.clear();
            expect(builder.count).toBe(0);
            expect(builder.isRegistered('handlers')).toBe(false);
        });
    });

    describe('scope lifecycle', () => {
        it('should propagate multi-registrations to scoped providers', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addScoped('validators', EmailValidator)
                .addScoped('validators', PhoneValidator)
                .build();

            const scope = container.startScope();

            // Singletons shared across scopes
            const rootHandlers = container.getAll('handlers');
            const scopeHandlers = scope.getAll('handlers');
            expect(rootHandlers[0]).toBe(scopeHandlers[0]);

            // Scoped creates new instances per scope
            const rootValidators = container.getAll('validators');
            const scopeValidators = scope.getAll('validators');
            expect(rootValidators[0]).not.toBe(scopeValidators[0]);
        });

        it('should dispose multi-registration services', () => {
            let disposed = 0;
            const container = new ContainerBuilder()
                .addSingletonFactory('disposables', () => ({
                    dispose() { disposed++; }
                }))
                .addSingletonFactory('disposables', () => ({
                    dispose() { disposed++; }
                }))
                .build();

            // Resolve to create instances
            container.getAll('disposables');
            container.dispose();
            expect(disposed).toBe(2);
        });
    });

    describe('getAll on unregistered key', () => {
        it('should throw for unknown keys', () => {
            const container = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .build();

            expect(() => container.getAll('unknown' as any)).toThrow();
        });
    });

    describe('builder immutability after build', () => {
        it('should throw when calling add* after build()', () => {
            const builder = new ContainerBuilder()
                .addSingleton('handlers', HandlerA);

            builder.build();

            expect(() => builder.addSingleton('handlers', HandlerB))
                .toThrow(/Cannot modify ContainerBuilder after it has been built/);
        });

        it('should throw when calling addSingletonFactory after build()', () => {
            const builder = new ContainerBuilder()
                .addSingletonFactory('items', () => ({}));

            builder.build();

            expect(() => builder.addSingletonFactory('items', () => ({})))
                .toThrow(/Cannot modify ContainerBuilder after it has been built/);
        });
    });

    describe('get() on multi-key verifies instances', () => {
        it('should return correct instance types via get()', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .build();

            const handlers = container.get('handlers');
            expect(handlers[0]).toBeInstanceOf(HandlerA);
            expect(handlers[1]).toBeInstanceOf(HandlerB);
            expect((handlers[0] as HandlerA).handle()).toBe('A');
            expect((handlers[1] as HandlerB).handle()).toBe('B');
        });
    });

    describe('multiple independent multi-keys', () => {
        it('should manage separate multi-keys independently', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .addSingleton('validators', EmailValidator)
                .addSingleton('validators', PhoneValidator)
                .build();

            const handlers = container.getAll('handlers');
            const validators = container.getAll('validators');

            expect(handlers).toHaveLength(2);
            expect(validators).toHaveLength(2);
            expect(handlers[0]).toBeInstanceOf(HandlerA);
            expect(validators[0]).toBeInstanceOf(EmailValidator);
        });
    });

    describe('only multi-registrations', () => {
        it('should build container with only add* and no register*', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .build();

            const handlers = container.getAll('handlers');
            expect(handlers).toHaveLength(2);
        });
    });

    describe('mixed lifecycles under same key', () => {
        it('should support different lifecycles under one multi-key', () => {
            const container = new ContainerBuilder()
                .addSingleton('services', HandlerA)
                .addTransient('services', HandlerB)
                .build();

            const first = container.getAll('services');
            const second = container.getAll('services');

            // Singleton: same instance
            expect(first[0]).toBe(second[0]);
            // Transient: different instance
            expect(first[1]).not.toBe(second[1]);
        });
    });

    describe('getRegisteredServiceNames', () => {
        it('should include multi-keys in registered service names', () => {
            const builder = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB);

            const names = builder.getRegisteredServiceNames();
            expect(names).toContain('config');
            expect(names).toContain('handlers');
            expect(names).toHaveLength(2);
        });
    });

    describe('scoped multi-service dispose', () => {
        it('should dispose scoped multi-services when scope is disposed', () => {
            let disposed = 0;
            const container = new ContainerBuilder()
                .addScopedFactory('resources', () => ({
                    dispose() { disposed++; }
                }))
                .addScopedFactory('resources', () => ({
                    dispose() { disposed++; }
                }))
                .build();

            const scope = container.startScope();
            scope.getAll('resources'); // create instances
            scope.dispose();

            expect(disposed).toBe(2);
        });
    });

    describe('nested scope with multi-registrations', () => {
        it('should propagate multi-registrations through nested scopes', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addScoped('validators', EmailValidator)
                .build();

            const scope1 = container.startScope();
            const scope2 = scope1.startScope();

            // Singleton shared across all levels
            expect(container.getAll('handlers')[0]).toBe(scope2.getAll('handlers')[0]);

            // Scoped: each scope gets own instance
            const v1 = scope1.getAll('validators')[0];
            const v2 = scope2.getAll('validators')[0];
            expect(v1).not.toBe(v2);
        });
    });

    describe('add* with dependencies (scoped/transient)', () => {
        it('should resolve dependencies for addScoped', () => {
            const container = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .addScoped('middleware', AuthMiddleware, 'config')
                .build();

            const scope = container.startScope();
            const mw = scope.getAll('middleware');
            expect(mw[0]).toBeInstanceOf(AuthMiddleware);
            expect((mw[0] as AuthMiddleware).config).toBeInstanceOf(AppConfig);
        });

        it('should resolve dependencies for addTransient', () => {
            const container = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .addTransient('middleware', AuthMiddleware, 'config')
                .build();

            const mw = container.getAll('middleware');
            expect(mw[0]).toBeInstanceOf(AuthMiddleware);
            expect((mw[0] as AuthMiddleware).config).toBeInstanceOf(AppConfig);
        });
    });

    describe('factory resolves multi-key', () => {
        it('should allow factory to resolve a multi-key and receive array', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .addSingletonFactory('aggregator', (p) => {
                    const handlers = p.get('handlers');
                    return { count: handlers.length, handlers };
                })
                .build();

            const agg = container.getAll('aggregator');
            expect(agg[0].count).toBe(2);
            expect(agg[0].handlers[0]).toBeInstanceOf(HandlerA);
            expect(agg[0].handlers[1]).toBeInstanceOf(HandlerB);
        });
    });

    describe('constructor multi-dep on multi-key', () => {
        it('should pass array to constructor when dependency is a multi-key', () => {
            class Aggregator {
                constructor(public handlers: any) {}
            }

            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .registerSingleton('aggregator', Aggregator, 'handlers')
                .build();

            const agg = container.get('aggregator');
            // get('handlers') on a multi-key returns the array
            expect(Array.isArray(agg.handlers)).toBe(true);
            expect(agg.handlers).toHaveLength(2);
            expect(agg.handlers[0]).toBeInstanceOf(HandlerA);
            expect(agg.handlers[1]).toBeInstanceOf(HandlerB);
        });
    });

    describe('single add* creates single-element array', () => {
        it('should return single-element array for one add*', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .build();

            const handlers = container.getAll('handlers');
            expect(handlers).toHaveLength(1);
            expect(handlers[0]).toBeInstanceOf(HandlerA);
        });
    });

    describe('registration order preservation', () => {
        it('should preserve registration order in getAll results', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerC)
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .build();

            const handlers = container.getAll('handlers');
            // Order must match registration order: C, A, B
            expect(handlers[0]).toBeInstanceOf(HandlerC);
            expect(handlers[1]).toBeInstanceOf(HandlerA);
            expect(handlers[2]).toBeInstanceOf(HandlerB);
        });
    });

    describe('remove() on multi-key', () => {
        it('should remove multi-registration and clean up completely', () => {
            const builder = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB);

            expect(builder.isRegistered('handlers')).toBe(true);

            const removed = builder.remove('handlers');
            expect(removed).toBe(true);
            expect(builder.isRegistered('handlers')).toBe(false);
            expect(builder.count).toBe(0);
        });

        it('should allow re-registration after remove of multi-key', () => {
            const builder = new ContainerBuilder()
                .addSingleton('handlers', HandlerA);

            builder.remove('handlers');

            // Should be able to register as single after removing multi
            const container = builder
                .registerSingleton('handlers', HandlerC)
                .build();

            const handler = container.get('handlers');
            expect(handler).toBeInstanceOf(HandlerC);
        });
    });

    describe('resolution error handling', () => {
        it('should throw meaningful error when multi-service dependency fails', () => {
            const container = new ContainerBuilder()
                .addSingleton('middleware', AuthMiddleware, 'missingService')
                .build();

            expect(() => container.getAll('middleware')).toThrow(/missingService/);
        });

        it('should throw meaningful error via get() on failing multi-service', () => {
            const container = new ContainerBuilder()
                .addSingletonFactory('broken', () => { throw new Error('factory failed'); })
                .build();

            expect(() => container.get('broken')).toThrow(/factory failed/);
        });
    });

    describe('validation with satisfied deps', () => {
        it('should report no issues when multi-service deps are satisfied', () => {
            const builder = new ContainerBuilder()
                .registerSingleton('config', AppConfig)
                .addSingleton('middleware', AuthMiddleware, 'config');

            const issues = builder.validate();
            expect(issues).toHaveLength(0);
        });

        it('should report no issues for multi-services without deps', () => {
            const builder = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB);

            const issues = builder.validate();
            expect(issues).toHaveLength(0);
        });
    });

    describe('collision guard covers all variants', () => {
        it('should throw when addScopedFactory collides with registerScoped', () => {
            expect(() => {
                new ContainerBuilder()
                    .registerScoped('svc', HandlerA)
                    .addScopedFactory('svc', () => new HandlerB());
            }).toThrow(/already registered as a single service/);
        });

        it('should throw when registerTransient collides with addTransient', () => {
            expect(() => {
                new ContainerBuilder()
                    .addTransient('svc', HandlerA)
                    .registerTransient('svc', HandlerB);
            }).toThrow(/already registered as a multi-service/);
        });

        it('should throw when registerSingletonFactory collides with addSingleton', () => {
            expect(() => {
                new ContainerBuilder()
                    .addSingleton('svc', HandlerA)
                    .registerSingletonFactory('svc', () => new HandlerB());
            }).toThrow(/already registered as a multi-service/);
        });
    });

    describe('get() on unregistered key with multi-registrations present', () => {
        it('should throw for key not in either map', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .build();

            expect(() => container.get('nonexistent' as any)).toThrow(/No service registered/);
        });
    });

    describe('partial multi-resolution failure', () => {
        it('should throw and not return partial results when a middle factory fails', () => {
            const container = new ContainerBuilder()
                .addSingletonFactory('items', () => ({ id: 1 }))
                .addSingletonFactory('items', () => { throw new Error('factory-2-boom'); })
                .addSingletonFactory('items', () => ({ id: 3 }))
                .build();

            expect(() => container.getAll('items')).toThrow(/factory-2-boom/);
        });

        it('should throw via get() on partial multi-resolution failure', () => {
            const container = new ContainerBuilder()
                .addSingletonFactory('items', () => ({ id: 1 }))
                .addSingletonFactory('items', () => { throw new Error('boom'); })
                .build();

            expect(() => container.get('items')).toThrow(/boom/);
        });
    });

    describe('deeply nested scopes (3+ levels) with multi-registrations', () => {
        it('should share singletons across 4 scope levels', () => {
            const container = new ContainerBuilder()
                .addSingleton('handlers', HandlerA)
                .addSingleton('handlers', HandlerB)
                .build();

            const s1 = container.startScope();
            const s2 = s1.startScope();
            const s3 = s2.startScope();

            const root = container.getAll('handlers');
            const deep = s3.getAll('handlers');

            expect(root[0]).toBe(deep[0]);
            expect(root[1]).toBe(deep[1]);
        });

        it('should isolate scoped multi-services across 3+ levels', () => {
            const container = new ContainerBuilder()
                .addScoped('validators', EmailValidator)
                .addScoped('validators', PhoneValidator)
                .build();

            const s1 = container.startScope();
            const s2 = s1.startScope();
            const s3 = s2.startScope();

            const v1 = s1.getAll('validators');
            const v2 = s2.getAll('validators');
            const v3 = s3.getAll('validators');

            // Each scope must have its own instances
            expect(v1[0]).not.toBe(v2[0]);
            expect(v2[0]).not.toBe(v3[0]);
            expect(v1[1]).not.toBe(v3[1]);

            // Same scope returns same instances
            expect(s2.getAll('validators')[0]).toBe(v2[0]);
        });

        it('should mix singleton sharing and scoped isolation at 3+ levels', () => {
            const container = new ContainerBuilder()
                .addSingleton('shared', HandlerA)
                .addScoped('perScope', EmailValidator)
                .build();

            const s1 = container.startScope();
            const s2 = s1.startScope();
            const s3 = s2.startScope();

            // Singleton: same everywhere
            expect(container.getAll('shared')[0]).toBe(s3.getAll('shared')[0]);

            // Scoped: different per scope
            expect(s1.getAll('perScope')[0]).not.toBe(s2.getAll('perScope')[0]);
            expect(s2.getAll('perScope')[0]).not.toBe(s3.getAll('perScope')[0]);
        });
    });
});

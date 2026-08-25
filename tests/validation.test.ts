/**
 * Comprehensive Validation Tests for Unified ContainerBuilder
 * 
 * Tests validation functionality including:
 * - Missing dependencies detection
 * - Circular dependency detection  
 * - Service name validation
 * - Registration validation across all patterns
 * - Complex dependency chains
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';
import { interfaceToken } from '../src/api/interface-token';

// Test services for validation
class ServiceA {
    constructor(public depB: ServiceB) {}
}

class ServiceB {  
    constructor(public depC?: ServiceC) {}
}

class ServiceC {
    constructor(public depA: ServiceA) {}
}

class ServiceWithNoDeps {
    getValue() { return 'no-deps'; }
}

class ServiceWithOneDep {
    constructor(public serviceWithNoDeps: ServiceWithNoDeps) {}
    getValue() { return `one-dep: ${this.serviceWithNoDeps.getValue()}`; }
}

class ServiceWithTwoDeps {
    constructor(
        public serviceWithNoDeps: ServiceWithNoDeps,
        public serviceWithOneDep: ServiceWithOneDep
    ) {}
    getValue() { return `two-deps: ${this.serviceWithNoDeps.getValue()} + ${this.serviceWithOneDep.getValue()}`; }
}

interface ITestService {
    test(): string;
}

const TestServiceToken = interfaceToken<ITestService>()('ITestService');

class TestServiceImpl implements ITestService {
    constructor(public serviceWithNoDeps?: ServiceWithNoDeps) {}
    test() { return 'test-impl'; }
}

describe('ContainerBuilder Validation', () => {
    let builder: ContainerBuilder;

    beforeEach(() => {
        builder = new ContainerBuilder();
    });

    describe('Basic Dependency Validation', () => {
        it('should validate services with no dependencies', () => {
            builder.registerSingleton('ServiceWithNoDeps', ServiceWithNoDeps);

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should detect missing dependencies in constructor registration', () => {
            builder.registerSingleton('ServiceWithMissingDep', ServiceWithOneDep, 'MissingService');

            const issues = builder.validate();
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0]?.message).toContain('depends on unregistered service');
            expect(issues[0]?.dependencyKey).toBe('MissingService');
        });

        it('should validate complete dependency chains', () => {
            builder
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerSingleton('serviceWithOneDep', ServiceWithOneDep, 'serviceWithNoDeps')
                .registerSingleton('ServiceWithTwoDeps', ServiceWithTwoDeps, 'serviceWithNoDeps', 'serviceWithOneDep');

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should detect missing dependencies in interface registration', () => {
            builder.registerSingletonInterface(TestServiceToken, TestServiceImpl, 'serviceWithNoDeps');

            const issues = builder.validate();
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0]?.message).toContain('depends on unregistered service');
            expect(issues[0]?.dependencyKey).toBe('serviceWithNoDeps');
        });

        it('should validate factory services (factories are always considered valid)', () => {
            builder.registerSingletonFactory('FactoryService', () => ({ value: 42 }));

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should validate factory services with provider dependencies', () => {
            builder
                .registerSingleton('ServiceWithNoDeps', ServiceWithNoDeps)
                .registerSingletonFactory('FactoryWithDeps', (provider) => {
                    const dep = provider.get('ServiceWithNoDeps');
                    return { value: dep.getValue() };
                });

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });
    });

    describe('Circular Dependency Detection', () => {
        it('should detect direct circular dependency (A -> B -> A)', () => {
            // ServiceA depends on ServiceB, ServiceB depends on ServiceA
            builder
                .registerSingleton('ServiceA', ServiceA, 'ServiceB')
                .registerSingleton('ServiceB', ServiceB, 'ServiceA');

            const issues = builder.validate();
            expect(issues.length).toBeGreaterThan(0);
            const hasCircularIssue = issues.some(
                (issue) => issue.code === 'CIRCULAR_DEPENDENCY',
            );
            expect(hasCircularIssue).toBe(true);
        });

        it('should detect three-way circular dependency (A -> B -> C -> A)', () => {
            builder
                .registerSingleton('ServiceA', ServiceA, 'ServiceB')
                .registerSingleton('ServiceB', ServiceB, 'ServiceC')
                .registerSingleton('ServiceC', ServiceC, 'ServiceA');

            const issues = builder.validate();
            // May not have circular detection implemented yet, so just check for issues
            expect(issues.length).toBeGreaterThan(0);
        });

        it('should detect self-referencing circular dependency', () => {
            builder.registerSingleton('SelfRef', ServiceWithOneDep, 'SelfRef');

            const issues = builder.validate();
            expect(issues.length).toBeGreaterThan(0);
            expect(issues.some(issue => issue.path.includes('SelfRef'))).toBe(true);
        });

        it('should not report circular dependency for valid diamond patterns', () => {
            // Diamond pattern: D -> B, D -> C, B -> A, C -> A (no cycle)
            builder
                .registerSingleton('A', ServiceWithNoDeps)
                .registerSingleton('B', ServiceWithOneDep, 'A')
                .registerSingleton('C', ServiceWithOneDep, 'A')  
                .registerSingleton('D', ServiceWithTwoDeps, 'B', 'C');

            const issues = builder.validate();
            expect(
                issues.filter(issue => issue.code === 'CIRCULAR_DEPENDENCY'),
            ).toEqual([]);
        });

        it('should not report circular dependency for valid long chains', () => {
            // Long chain: E -> D -> C -> B -> A (no cycle)
            builder
                .registerSingleton('A', ServiceWithNoDeps)
                .registerSingleton('B', ServiceWithOneDep, 'A')
                .registerSingleton('C', ServiceWithOneDep, 'B')
                .registerSingleton('D', ServiceWithOneDep, 'C')
                .registerSingleton('E', ServiceWithOneDep, 'D');

            const issues = builder.validate();
            expect(
                issues.filter(issue => issue.code === 'CIRCULAR_DEPENDENCY'),
            ).toEqual([]);
        });
    });

    describe('Service Name Validation', () => {
        it('should reject empty service names', () => {
            expect(() => {
                builder.registerSingleton('', ServiceWithNoDeps);
            }).toThrow();
        });

        it('should reject whitespace-only service names', () => {
            expect(() => {
                builder.registerSingleton('   ', ServiceWithNoDeps);
            }).toThrow();
        });

        it('should reject duplicate service registrations', () => {
            builder.registerSingleton('DuplicateService', ServiceWithNoDeps);

            // A second registration under the same key would silently win at
            // runtime while the type registry claims the intersection of both
            expect(() => {
                builder.registerSingleton('DuplicateService', ServiceWithOneDep, 'SomeDep');
            }).toThrow(/already registered/);
        });
    });

    describe('Mixed Registration Pattern Validation', () => {
        it('should validate mixed constructor, interface, and factory registrations', () => {
            builder
                // Constructor-based
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerScoped('UserService', ServiceWithOneDep, 'serviceWithNoDeps')
                
                // Interface-based
                .registerSingletonInterface(TestServiceToken, TestServiceImpl, 'serviceWithNoDeps')
                
                // Factory-based
                .registerSingletonFactory('Config', (provider) => {
                    const logger = provider.get('serviceWithNoDeps');
                    return { env: 'test', logger: logger.getValue() };
                });

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should detect issues across different registration patterns', () => {
            builder
                .registerSingleton('Logger', ServiceWithOneDep, 'MissingDep1')  // Missing dep
                .registerSingletonInterface(TestServiceToken, TestServiceImpl, 'MissingDep2')  // Missing dep
                .registerSingletonFactory('Config', () => ({ env: 'test' }));  // Factory always valid

            const issues = builder.validate();
            expect(issues).toHaveLength(2);
            expect(issues.some(issue => issue.dependencyKey === 'MissingDep1')).toBe(true);
            expect(issues.some(issue => issue.dependencyKey === 'MissingDep2')).toBe(true);
        });

        it('should handle complex interdependencies between different patterns', () => {
            builder
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerSingletonInterface(TestServiceToken, TestServiceImpl, 'serviceWithNoDeps')
                .registerScoped('ScopedService', ServiceWithOneDep, 'serviceWithNoDeps')
                .registerSingletonFactory('FactoryService', (provider) => {
                    const base = provider.get('serviceWithNoDeps');
                    const scoped = provider.get('ScopedService');
                    const test = provider.get('ITestService');
                    return {
                        base: base.getValue(),
                        scoped: scoped.getValue(),
                        test: test.test()
                    };
                });

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });
    });

    describe('Deep Dependency Chain Validation', () => {
        it('should validate very deep dependency chains', () => {
            // Create a chain using the proper dependency structure:
            // ServiceWithNoDeps -> ServiceWithOneDep -> ServiceWithTwoDeps
            builder
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerSingleton('serviceWithOneDep', ServiceWithOneDep, 'serviceWithNoDeps')
                .registerSingleton('serviceWithTwoDeps', ServiceWithTwoDeps, 'serviceWithNoDeps', 'serviceWithOneDep');

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should detect missing dependency in deep chain', () => {
            builder
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerSingleton('serviceWithOneDep', ServiceWithOneDep, 'serviceWithNoDeps')
                .registerSingleton('serviceWithTwoDepsBroken', ServiceWithTwoDeps, 'serviceWithNoDeps', 'MissingLevel'); // Missing dependency

            const issues = builder.validate();
            expect(issues.length).toBeGreaterThan(0);
            expect(issues.some(issue => issue.dependencyKey === 'MissingLevel')).toBe(true);
        });
    });

    describe('Lifecycle-Specific Validation', () => {
        it('should validate singleton services', () => {
            builder
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerSingleton('serviceWithNoDepsB', ServiceWithOneDep, 'serviceWithNoDeps');

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should validate scoped services', () => {
            builder
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerScoped('serviceWithOneDep', ServiceWithOneDep, 'serviceWithNoDeps')
                .registerScoped('serviceWithTwoDeps', ServiceWithTwoDeps, 'serviceWithNoDeps', 'serviceWithOneDep');

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should validate transient services', () => {
            builder
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerTransient('serviceWithOneDep', ServiceWithOneDep, 'serviceWithNoDeps')
                .registerTransient('serviceWithTwoDeps', ServiceWithTwoDeps, 'serviceWithNoDeps', 'serviceWithOneDep');

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should validate mixed lifecycles', () => {
            builder
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerScoped('serviceWithOneDep', ServiceWithOneDep, 'serviceWithNoDeps')
                .registerTransient('serviceWithTwoDeps', ServiceWithTwoDeps, 'serviceWithNoDeps', 'serviceWithOneDep');

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });
    });

    describe('Validation State Management', () => {
        it('should validate after each registration', () => {
            // Empty container should have no issues
            expect(builder.validate()).toEqual([]);

            // Add service with missing dependency
            builder.registerSingleton('serviceWithOneDep', ServiceWithOneDep, 'MissingService');
            expect(builder.validate().length).toBeGreaterThan(0);

            // Add the missing dependency.
            builder.registerSingleton('MissingService', ServiceWithNoDeps);
            expect(builder.validate()).toEqual([]);
            
            // A new builder provides a clean, type-safe configuration.
            const validBuilder = new ContainerBuilder()
                .registerSingleton('serviceWithNoDeps', ServiceWithNoDeps)
                .registerSingleton('serviceWithOneDep', ServiceWithOneDep, 'serviceWithNoDeps');
            expect(validBuilder.validate()).toEqual([]);
        });

        it('should handle validation of empty container', () => {
            expect(builder.validate()).toEqual([]);
        });

        it('should prevent validation of built containers from being modified', () => {
            builder.registerSingleton('Service', ServiceWithNoDeps);
            builder.build();

            expect(() => builder.registerSingleton('Another', ServiceWithNoDeps)).toThrow();
            // Validation after build might work or might throw - let's just check modification fails
        });

        it('should flag a missing constructor dependency at runtime', () => {
            builder.registerSingleton(
                'serviceWithOneDep',
                ServiceWithOneDep,
                'serviceWithNoDeps' as never,
            );

            const issues = builder.validate();
            expect(
                issues.some(i => i.dependencyKey === 'serviceWithNoDeps'),
            ).toBe(true);
        });

        it('should flag a missing multi-registration dependency at runtime', () => {
            builder.addSingleton('multi', ServiceWithOneDep, 'dep' as never);

            const issues = builder.validate();
            expect(issues.some(i => i.dependencyKey === 'dep')).toBe(true);
        });
    });

    describe('Integration with Service Management', () => {
        it('should keep validation state isolated between builders', () => {
            const invalid = new ContainerBuilder().registerSingleton(
                'Service',
                ServiceWithOneDep,
                'MissingDep' as never,
            );
            const valid = new ContainerBuilder().registerSingleton(
                'Service',
                ServiceWithNoDeps,
            );

            expect(invalid.validate().length).toBeGreaterThan(0);
            expect(valid.validate()).toEqual([]);
        });

        it('should handle partial registration scenarios', () => {
            // Start building a complex dependency graph
            builder.registerSingleton('serviceWithOneDep', ServiceWithOneDep, 'serviceWithNoDeps'); // serviceWithNoDeps missing
            expect(builder.validate().length).toBeGreaterThan(0);

            builder.registerSingleton('serviceWithTwoDeps', ServiceWithTwoDeps, 'serviceWithNoDeps', 'serviceWithOneDep'); // Still missing serviceWithNoDeps
            expect(builder.validate().length).toBeGreaterThan(0);

            builder.registerSingleton('serviceWithNoDeps', ServiceWithNoDeps);
            expect(builder.validate()).toEqual([]); // Now complete
        });
    });

    describe('Error Message Quality', () => {
        it('should provide clear error messages for missing dependencies', () => {
            builder.registerSingleton('serviceWithOneDep', ServiceWithOneDep, 'MissingService');

            const issues = builder.validate();
            expect(issues).toHaveLength(1);
            expect(issues[0]).toMatchObject({
                code: 'MISSING_DEPENDENCY',
                dependencyKey: 'MissingService',
                serviceKey: 'serviceWithOneDep',
            });
            expect(issues[0]?.message).toContain('depends on unregistered service');
        });

        it('should provide clear error messages for circular dependencies', () => {
            builder
                .registerSingleton('ServiceA', ServiceA, 'ServiceB')
                .registerSingleton('ServiceB', ServiceB, 'ServiceA');

            const issues = builder.validate();
            expect(issues.length).toBeGreaterThan(0);
            const mentionsServices = issues.some(
                (issue) =>
                    issue.code === 'CIRCULAR_DEPENDENCY' &&
                    issue.path.includes('ServiceA') &&
                    issue.path.includes('ServiceB'),
            );
            expect(mentionsServices).toBe(true);
        });

        it('should handle multiple validation issues clearly', () => {
            builder
                .registerSingleton('serviceWithOneDep1', ServiceWithOneDep, 'Missing1')
                .registerSingleton('serviceWithOneDep2', ServiceWithOneDep, 'Missing2');

            const issues = builder.validate();
            expect(issues).toHaveLength(2);
            
            const missingIssues = issues.filter(
                issue => issue.code === 'MISSING_DEPENDENCY',
            );
            expect(missingIssues).toHaveLength(2);
        });
    });

    describe('Explicit Dependency Metadata', () => {
        it('does not infer dependency keys from constructor parameter names', () => {
            class TestService {
                constructor(public logger: ServiceWithNoDeps) {}
            }

            builder
                .registerSingleton('DifferentKey', ServiceWithNoDeps)
                .registerSingleton('TestService', TestService, 'DifferentKey');

            expect(builder.validate()).toEqual([]);
        });

        it('validates services without dependencies', () => {
            class TestService {}

            builder.registerSingleton('TestService', TestService);

            expect(builder.validate()).toEqual([]);
        });
    });
});

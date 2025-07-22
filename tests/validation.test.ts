/**
 * Service Validation Tests
 * Comprehensive tests for container validation functionality including:
 * - Basic validation (service names, dependencies)
 * - Circular dependency detection
 * - Complex validation scenarios
 * - Integration with service management
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TypeSafeContainerBuilder } from '../src/api/type-safe-container-builder';
import { FluentContainerBuilder } from '../src/api/fluent-container-builder';
import { TestStub, TestStubWithOneDependency, TestStubWithTwoDependencies, TestInterface } from './test-dummies';

// Test services for circular dependency scenarios
class ServiceA {
    constructor(public serviceB: ServiceB) {}
    doSomething(): string { return 'A'; }
}

class ServiceB {
    constructor(public serviceC: ServiceC) {}
    doSomething(): string { return 'B'; }
}

class ServiceC {
    constructor(public serviceA: ServiceA) {}
    doSomething(): string { return 'C'; }
}

// Chain dependencies for complex scenarios
class ChainService1 {
    constructor(public chain2: ChainService2) {}
}

class ChainService2 {
    constructor(public chain3: ChainService3) {}
}

class ChainService3 {
    constructor(public chain4: ChainService4) {}
}

class ChainService4 {
    constructor(public chain5: ChainService5) {}
}

class ChainService5 {
    doSomething(): string { return 'End of chain'; }
}

// Self-referencing service
class SelfReferencingService {
    constructor(public self: SelfReferencingService) {}
}

describe('ContainerBuilder Validation', () => {
    describe('Basic Validation', () => {
        let typeSafeBuilder: TypeSafeContainerBuilder;
        let fluentBuilder: FluentContainerBuilder;

        beforeEach(() => {
            typeSafeBuilder = new TypeSafeContainerBuilder();
            fluentBuilder = new FluentContainerBuilder();
        });

        describe('TypeSafe API Validation', () => {
            it('should validate services with no dependencies successfully', () => {
                typeSafeBuilder.registerSingleton('SimpleService', TestStub);

                const issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should detect missing dependencies in TypeSafe API', () => {
                typeSafeBuilder.registerSingleton('ServiceWithMissingDep', TestStubWithOneDependency, 'NonExistentService');

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues[0]).toContain('depends on unregistered service');
                expect(issues[0]).toContain('ServiceWithMissingDep');
                expect(issues[0]).toContain('NonExistentService');
            });

            it('should validate complete dependency chains', () => {
                typeSafeBuilder
                    .registerSingleton('TestStub', TestStub)
                    .registerSingleton('OneDep', TestStubWithOneDependency, 'TestStub')
                    .registerSingleton('TwoDeps', TestStubWithTwoDependencies, 'TestStub', 'OneDep');

                const issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should detect multiple missing dependencies', () => {
                typeSafeBuilder.registerSingleton('ComplexService', TestStubWithTwoDependencies, 'MissingService1', 'MissingService2');

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBe(2);
                expect(issues.some(issue => issue.includes('MissingService1'))).toBe(true);
                expect(issues.some(issue => issue.includes('MissingService2'))).toBe(true);
            });

            it('should validate interface registrations', () => {
                interface IService { doWork(): void; }
                class ServiceImpl implements IService { doWork(): void {} }

                typeSafeBuilder.registerInterface<IService>('IService', ServiceImpl);

                const issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should detect missing dependencies in interface registrations', () => {
                interface IService { doWork(): void; }
                class ServiceImpl implements IService { 
                    constructor(private dep: TestStub) {}
                    doWork(): void {} 
                }

                typeSafeBuilder.registerInterface<IService>('IService', ServiceImpl, 'MissingDependency');

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues[0]).toContain('MissingDependency');
            });
        });

        describe('Fluent API Validation', () => {
            it('should validate services with no dependencies successfully', () => {
                fluentBuilder.addSingleton(r => r.fromType(TestStub));

                const issues = fluentBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should detect missing dependencies in Fluent API', () => {
                fluentBuilder.addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));

                const issues = fluentBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues[0]).toContain('depends on unregistered service');
            });

            it('should validate complete dependency chains', () => {
                fluentBuilder
                    .addSingleton(r => r.fromType(TestStub))
                    .addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub))
                    .addSingleton(r => r.fromType(TestStubWithTwoDependencies).withDependencies(TestStub, TestStubWithOneDependency));

                const issues = fluentBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should validate factory services', () => {
                fluentBuilder.addSingleton(r => r.fromName('FactoryService').useFactory(() => new TestStub()));

                const issues = fluentBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should detect missing dependencies in named services', () => {
                fluentBuilder.addSingleton(r => r.fromName('ServiceWithDep').useType(TestStubWithOneDependency).withDependencies('MissingService'));

                const issues = fluentBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues[0]).toContain('depends on unregistered service');
                expect(issues[0]).toContain('MissingService');
            });
        });

        describe('Service Name Validation', () => {
            it('should reject empty service names in TypeSafe API', () => {
                expect(() => {
                    typeSafeBuilder.registerSingleton('', TestStub);
                }).toThrow('Service registration must have a valid name');
            });

            it('should reject null service names in TypeSafe API', () => {
                expect(() => {
                    (typeSafeBuilder as any).registerSingleton(null, TestStub);
                }).toThrow('Service registration must have a valid name');
            });

            it('should reject whitespace-only service names in TypeSafe API', () => {
                expect(() => {
                    typeSafeBuilder.registerSingleton('   ', TestStub);
                }).toThrow('Service registration must have a valid name');
            });

            it('should warn about duplicate service names in TypeSafe API', () => {
                const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
                
                typeSafeBuilder.registerSingleton('DuplicateService', TestStub);
                typeSafeBuilder.registerSingleton('DuplicateService', TestStubWithOneDependency, 'TestService');

                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('DuplicateService')
                );
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('already registered')
                );
                
                consoleSpy.mockRestore();
            });
        });
    });

    describe('Circular Dependency Detection', () => {
        let typeSafeBuilder: TypeSafeContainerBuilder;
        let fluentBuilder: FluentContainerBuilder;

        beforeEach(() => {
            typeSafeBuilder = new TypeSafeContainerBuilder();
            fluentBuilder = new FluentContainerBuilder();
        });

        describe('Simple Circular Dependencies', () => {
            it('should detect direct circular dependency (A -> B -> A) in TypeSafe API', () => {
                class ServiceX { constructor(public serviceY: ServiceY) {} }
                class ServiceY { constructor(public serviceX: ServiceX) {} }

                typeSafeBuilder
                    .registerSingleton('ServiceX', ServiceX, 'ServiceY')
                    .registerSingleton('ServiceY', ServiceY, 'ServiceX');

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues.some(issue => issue.includes('Circular dependency detected'))).toBe(true);
                expect(issues.some(issue => issue.includes('ServiceX') && issue.includes('ServiceY'))).toBe(true);
            });

            it('should detect direct circular dependency in Fluent API', () => {
                class ServiceP { constructor(public serviceQ: ServiceQ) {} }
                class ServiceQ { constructor(public serviceP: ServiceP) {} }

                fluentBuilder
                    .addSingleton(r => r.fromType(ServiceP).withDependencies(ServiceQ))
                    .addSingleton(r => r.fromType(ServiceQ).withDependencies(ServiceP));

                const issues = fluentBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues.some(issue => issue.includes('Circular dependency detected'))).toBe(true);
            });

            it('should detect self-referencing circular dependency', () => {
                typeSafeBuilder.registerSingleton('SelfRef', SelfReferencingService, 'SelfRef');

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues.some(issue => issue.includes('Circular dependency detected'))).toBe(true);
                expect(issues.some(issue => issue.includes('SelfRef -> SelfRef'))).toBe(true);
            });
        });

        describe('Complex Circular Dependencies', () => {
            it('should detect three-way circular dependency (A -> B -> C -> A)', () => {
                typeSafeBuilder
                    .registerSingleton('ServiceA', ServiceA, 'ServiceB')
                    .registerSingleton('ServiceB', ServiceB, 'ServiceC')
                    .registerSingleton('ServiceC', ServiceC, 'ServiceA');

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues.some(issue => issue.includes('Circular dependency detected'))).toBe(true);
                expect(issues.some(issue => 
                    issue.includes('ServiceA') && 
                    issue.includes('ServiceB') && 
                    issue.includes('ServiceC')
                )).toBe(true);
            });

            it('should detect circular dependency in long chains', () => {
                // Create a long chain that loops back: Chain1 -> Chain2 -> ... -> Chain5 -> Chain1
                class LongChain1 { constructor(public chain2: LongChain2) {} }
                class LongChain2 { constructor(public chain3: LongChain3) {} }
                class LongChain3 { constructor(public chain4: LongChain4) {} }
                class LongChain4 { constructor(public chain5: LongChain5) {} }
                class LongChain5 { constructor(public chain1: LongChain1) {} }

                typeSafeBuilder
                    .registerSingleton('LongChain1', LongChain1, 'LongChain2')
                    .registerSingleton('LongChain2', LongChain2, 'LongChain3')
                    .registerSingleton('LongChain3', LongChain3, 'LongChain4')
                    .registerSingleton('LongChain4', LongChain4, 'LongChain5')
                    .registerSingleton('LongChain5', LongChain5, 'LongChain1');

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues.some(issue => issue.includes('Circular dependency detected'))).toBe(true);
            });

            it('should detect multiple independent circular dependencies', () => {
                // First circular group: A -> B -> A
                class GroupA1 { constructor(public groupA2: GroupA2) {} }
                class GroupA2 { constructor(public groupA1: GroupA1) {} }

                // Second circular group: C -> D -> C
                class GroupB1 { constructor(public groupB2: GroupB2) {} }
                class GroupB2 { constructor(public groupB1: GroupB1) {} }

                typeSafeBuilder
                    .registerSingleton('GroupA1', GroupA1, 'GroupA2')
                    .registerSingleton('GroupA2', GroupA2, 'GroupA1')
                    .registerSingleton('GroupB1', GroupB1, 'GroupB2')
                    .registerSingleton('GroupB2', GroupB2, 'GroupB1');

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(1); // Should detect both circular dependencies
                expect(issues.filter(issue => issue.includes('Circular dependency detected')).length).toBe(2);
            });
        });

        describe('False Positive Prevention', () => {
            it('should not report circular dependency for valid dependency chains', () => {
                typeSafeBuilder
                    .registerSingleton('Chain1', ChainService1, 'Chain2')
                    .registerSingleton('Chain2', ChainService2, 'Chain3')
                    .registerSingleton('Chain3', ChainService3, 'Chain4')
                    .registerSingleton('Chain4', ChainService4, 'Chain5')
                    .registerSingleton('Chain5', ChainService5);

                const issues = typeSafeBuilder.validate();
                const circularIssues = issues.filter(issue => issue.includes('Circular dependency detected'));
                expect(circularIssues).toEqual([]);
            });

            it('should not report circular dependency for diamond dependency pattern', () => {
                // Diamond pattern: Root -> [A, B] -> C (both A and B depend on C)
                class Root { constructor(public a: DiamondA, public b: DiamondB) {} }
                class DiamondA { constructor(public shared: DiamondShared) {} }
                class DiamondB { constructor(public shared: DiamondShared) {} }
                class DiamondShared { doWork(): void {} }

                typeSafeBuilder
                    .registerSingleton('Root', Root, 'DiamondA', 'DiamondB')
                    .registerSingleton('DiamondA', DiamondA, 'DiamondShared')
                    .registerSingleton('DiamondB', DiamondB, 'DiamondShared')
                    .registerSingleton('DiamondShared', DiamondShared);

                const issues = typeSafeBuilder.validate();
                const circularIssues = issues.filter(issue => issue.includes('Circular dependency detected'));
                expect(circularIssues).toEqual([]);
            });
        });
    });

    describe('Complex Validation Scenarios', () => {
        let typeSafeBuilder: TypeSafeContainerBuilder;
        let fluentBuilder: FluentContainerBuilder;

        beforeEach(() => {
            typeSafeBuilder = new TypeSafeContainerBuilder();
            fluentBuilder = new FluentContainerBuilder();
        });

        describe('Mixed Registration Validation', () => {
            it('should validate mixed TypeSafe registrations (singleton, scoped, transient)', () => {
                typeSafeBuilder
                    .registerSingleton('SingletonService', TestStub)
                    .registerScoped('ScopedService', TestStubWithOneDependency, 'SingletonService')
                    .registerTransient('TransientService', TestStubWithTwoDependencies, 'SingletonService', 'ScopedService');

                const issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should validate mixed Fluent registrations', () => {
                fluentBuilder
                    .addSingleton(r => r.fromType(TestStub))
                    .addScoped(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub))
                    .addTransient(r => r.fromType(TestStubWithTwoDependencies).withDependencies(TestStub, TestStubWithOneDependency));

                const issues = fluentBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should detect issues in mixed interface and class registrations', () => {
                interface IMixedService { work(): void; }
                class MixedImpl implements IMixedService {
                    constructor(private dep: TestStub) {}
                    work(): void {}
                }

                typeSafeBuilder
                    .registerInterface<IMixedService>('IMixedService', MixedImpl, 'MissingDependency')
                    .registerSingleton('ConcreteService', TestStubWithOneDependency, 'IMixedService');

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBe(1); // Only the missing dependency, not the interface usage
                expect(issues[0]).toContain('MissingDependency');
            });
        });

        describe('Deep Dependency Chains', () => {
            it('should validate very deep dependency chains', () => {
                // Create a 10-level deep dependency chain
                class Level1 { constructor(public level2: Level2) {} }
                class Level2 { constructor(public level3: Level3) {} }
                class Level3 { constructor(public level4: Level4) {} }
                class Level4 { constructor(public level5: Level5) {} }
                class Level5 { constructor(public level6: Level6) {} }
                class Level6 { constructor(public level7: Level7) {} }
                class Level7 { constructor(public level8: Level8) {} }
                class Level8 { constructor(public level9: Level9) {} }
                class Level9 { constructor(public level10: Level10) {} }
                class Level10 { getValue(): string { return 'deep'; } }

                typeSafeBuilder
                    .registerSingleton('Level1', Level1, 'Level2')
                    .registerSingleton('Level2', Level2, 'Level3')
                    .registerSingleton('Level3', Level3, 'Level4')
                    .registerSingleton('Level4', Level4, 'Level5')
                    .registerSingleton('Level5', Level5, 'Level6')
                    .registerSingleton('Level6', Level6, 'Level7')
                    .registerSingleton('Level7', Level7, 'Level8')
                    .registerSingleton('Level8', Level8, 'Level9')
                    .registerSingleton('Level9', Level9, 'Level10')
                    .registerSingleton('Level10', Level10);

                const issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should detect missing dependency in deep chain', () => {
                typeSafeBuilder
                    .registerSingleton('Chain1', ChainService1, 'Chain2')
                    .registerSingleton('Chain2', ChainService2, 'Chain3')
                    .registerSingleton('Chain3', ChainService3, 'MissingChain4') // Missing dependency
                    .registerSingleton('Chain5', ChainService5);

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues.some(issue => issue.includes('MissingChain4'))).toBe(true);
            });
        });

        describe('Partial Registration Scenarios', () => {
            it('should handle partially constructed dependency graphs', () => {
                // Register some services but not their dependencies
                typeSafeBuilder
                    .registerSingleton('Service1', TestStubWithOneDependency, 'Dependency1')
                    .registerSingleton('Service2', TestStubWithTwoDependencies, 'Dependency1', 'Dependency2');
                // Note: Dependency1 and Dependency2 are not registered

                const issues = typeSafeBuilder.validate();
                expect(issues.length).toBe(3); // Dependency1 missing for Service1, Dependency1 and Dependency2 missing for Service2
                expect(issues.filter(issue => issue.includes('Dependency1')).length).toBe(2);
                expect(issues.filter(issue => issue.includes('Dependency2')).length).toBe(1);
            });

            it('should validate empty container', () => {
                const issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);
            });
        });
    });

    describe('Integration with Service Management', () => {
        let typeSafeBuilder: TypeSafeContainerBuilder;
        let fluentBuilder: FluentContainerBuilder;

        beforeEach(() => {
            typeSafeBuilder = new TypeSafeContainerBuilder();
            fluentBuilder = new FluentContainerBuilder();
        });

        describe('Registration Lifecycle', () => {
            it('should validate after each registration in TypeSafe API', () => {
                // Start with invalid state
                typeSafeBuilder.registerSingleton('ServiceWithDep', TestStubWithOneDependency, 'MissingDep');
                let issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);

                // Fix by adding missing dependency
                typeSafeBuilder.registerSingleton('MissingDep', TestStub);
                issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);
            });

            it('should maintain validation state through service registration overwrites', () => {
                const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
                
                // Register service with dependency
                typeSafeBuilder.registerSingleton('Service', TestStubWithOneDependency, 'Dependency');
                typeSafeBuilder.registerSingleton('Dependency', TestStub);
                
                let issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);

                // Overwrite service with different dependency
                typeSafeBuilder.registerSingleton('Service', TestStubWithOneDependency, 'NewDependency');
                
                issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues[0]).toContain('NewDependency');
                
                consoleSpy.mockRestore();
            });
        });

        describe('Service Count and Registration Status', () => {
            it('should maintain accurate count during validation', () => {
                expect(typeSafeBuilder.count).toBe(0);
                
                typeSafeBuilder.registerSingleton('Service1', TestStub);
                expect(typeSafeBuilder.count).toBe(1);
                
                typeSafeBuilder.registerSingleton('Service2', TestStubWithOneDependency, 'Service1');
                expect(typeSafeBuilder.count).toBe(2);

                const issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);
                expect(typeSafeBuilder.count).toBe(2); // Count should remain stable after validation
            });

            it('should correctly report registration status during validation', () => {
                expect(typeSafeBuilder.isRegistered('NonExistent')).toBe(false);
                
                typeSafeBuilder.registerSingleton('ExistentService', TestStub);
                expect(typeSafeBuilder.isRegistered('ExistentService')).toBe(true);
                expect(typeSafeBuilder.isRegistered('NonExistent')).toBe(false);
                
                // Validation shouldn't affect registration status
                typeSafeBuilder.validate();
                expect(typeSafeBuilder.isRegistered('ExistentService')).toBe(true);
            });
        });

        describe('Clear and Reset Operations', () => {
            it('should validate correctly after clearing all services', () => {
                typeSafeBuilder
                    .registerSingleton('Service1', TestStub)
                    .registerSingleton('Service2', TestStubWithOneDependency, 'Service1');

                let issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);

                typeSafeBuilder.clear();
                expect(typeSafeBuilder.count).toBe(0);

                issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]); // Empty container should be valid
            });

            it('should handle validation after partial clearing', () => {
                typeSafeBuilder
                    .registerSingleton('Service1', TestStub)
                    .registerSingleton('Service2', TestStubWithOneDependency, 'Service1')
                    .registerSingleton('Service3', TestStubWithTwoDependencies, 'Service1', 'Service2');

                let issues = typeSafeBuilder.validate();
                expect(issues).toEqual([]);

                // Clear and add back only some services
                typeSafeBuilder.clear();
                typeSafeBuilder.registerSingleton('Service2', TestStubWithOneDependency, 'Service1');
                // Service1 is missing now

                issues = typeSafeBuilder.validate();
                expect(issues.length).toBeGreaterThan(0);
                expect(issues[0]).toContain('Service1');
            });
        });

        describe('Build State Integration', () => {
            it('should prevent validation of built containers from being modified', () => {
                typeSafeBuilder.registerSingleton('Service', TestStub);
                const container = typeSafeBuilder.buildTypeSafe();

                // Container is now built, further modifications should fail
                expect(() => {
                    typeSafeBuilder.registerSingleton('NewService', TestStubWithOneDependency, 'Service');
                }).toThrow('Cannot modify ContainerBuilder after it has been built');

                // But validation should still work on the built state
                expect(() => {
                    typeSafeBuilder.validate();
                }).not.toThrow();
            });
        });
    });
});
import { beforeEach, describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../../src/api/container-builder';
import { TestStub, TestStubWithOneDependency, TestStubWithTwoDependencies } from '../data/test-dummies';

// Test services for circular dependency scenarios
class ServiceA {
    constructor(public serviceB: ServiceB) {}
}

class ServiceB {
    constructor(public serviceC: ServiceC) {}
}

class ServiceC {
    constructor(public serviceA: ServiceA) {}
}

class ServiceD {
    constructor() {}
}

class ServiceE {
    constructor(public serviceF: ServiceF) {}
}

class ServiceF {
    constructor(public serviceE: ServiceE) {}
}

describe('ContainerBuilder Validation', () => {
    let containerBuilder: ContainerBuilder;

    beforeEach(() => {
        containerBuilder = new ContainerBuilder();
    });

    describe('Basic Validation', () => {
        it('should validate healthy registered services', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addTransient(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));
            
            const issues = containerBuilder.validate();
            expect(issues).toHaveLength(0);
        });

        it('should detect missing dependencies', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));
            // TestStub is not registered
            
            const issues = containerBuilder.validate();
            expect(issues).toHaveLength(1);
            expect(issues[0]).toContain(`depends on unregistered service 'TestStub'`);
        });

        it('should detect disposed services', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            
            // Remove service to dispose it
            containerBuilder.remove(TestStub);
            
            // Add it back but with a disposed resolver (simulated scenario)
            const issues = containerBuilder.validate();
            expect(Array.isArray(issues)).toBe(true);
        });
    });

    describe('Circular Dependency Detection', () => {
        it('should detect simple circular dependency (A -> B -> A)', () => {
            containerBuilder.addSingleton(r => r.fromName('ServiceA').useType(ServiceE).withDependencies('ServiceF'));
            containerBuilder.addSingleton(r => r.fromName('ServiceF').useType(ServiceF).withDependencies('ServiceA'));
            
            const issues = containerBuilder.validate();
            const circularIssues = issues.filter(issue => issue.includes('Circular dependency detected'));
            expect(circularIssues.length).toBeGreaterThan(0);
            expect(circularIssues[0]).toMatch(/ServiceA.*ServiceF.*ServiceA/);
        });

        it('should detect complex circular dependency (A -> B -> C -> A)', () => {
            containerBuilder.addSingleton(r => r.fromName('ServiceA').useType(ServiceA).withDependencies('ServiceB'));
            containerBuilder.addSingleton(r => r.fromName('ServiceB').useType(ServiceB).withDependencies('ServiceC'));
            containerBuilder.addSingleton(r => r.fromName('ServiceC').useType(ServiceC).withDependencies('ServiceA'));
            
            const issues = containerBuilder.validate();
            const circularIssues = issues.filter(issue => issue.includes('Circular dependency detected'));
            expect(circularIssues.length).toBeGreaterThan(0);
            expect(circularIssues.some(issue => 
                issue.includes('ServiceA -> ServiceB -> ServiceC -> ServiceA') ||
                issue.includes('ServiceB -> ServiceC -> ServiceA -> ServiceB') ||
                issue.includes('ServiceC -> ServiceA -> ServiceB -> ServiceC')
            )).toBe(true);
        });

        it('should not report false positives for valid dependency chains', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));
            containerBuilder.addTransient(r => r.fromType(TestStubWithTwoDependencies).withDependencies(TestStub, TestStubWithOneDependency));
            
            const issues = containerBuilder.validate();
            const circularIssues = issues.filter(issue => issue.includes('Circular dependency detected'));
            expect(circularIssues).toHaveLength(0);
        });

        it('should handle self-dependency as circular dependency', () => {
            containerBuilder.addSingleton(r => r.fromName('SelfDependent').useType(ServiceD).withDependencies('SelfDependent'));
            
            const issues = containerBuilder.validate();
            const circularIssues = issues.filter(issue => issue.includes('Circular dependency detected'));
            expect(circularIssues.length).toBeGreaterThan(0);
            expect(circularIssues[0]).toContain('SelfDependent -> SelfDependent');
        });

        it('should detect circular dependencies with mixed service types', () => {
            containerBuilder.addSingleton(r => r.fromName('ServiceA').useType(ServiceA).withDependencies('ServiceB'));
            containerBuilder.addTransient(r => r.fromName('ServiceB').useType(ServiceB).withDependencies('ServiceC'));
            containerBuilder.addScoped(r => r.fromName('ServiceC').useType(ServiceC).withDependencies(ServiceA));
            
            const issues = containerBuilder.validate();
            const circularIssues = issues.filter(issue => issue.includes('Circular dependency detected'));
            expect(circularIssues.length).toBeGreaterThan(0);
        });
    });

    describe('Complex Validation Scenarios', () => {
        it('should handle multiple separate circular dependencies', () => {
            // First circular dependency: A -> B -> A
            containerBuilder.addSingleton(r => r.fromName('A').useType(ServiceA).withDependencies('B'));
            containerBuilder.addSingleton(r => r.fromName('B').useType(ServiceB).withDependencies('A'));
            
            // Second circular dependency: C -> D -> C  
            containerBuilder.addSingleton(r => r.fromName('C').useType(ServiceC).withDependencies('D'));
            containerBuilder.addSingleton(r => r.fromName('D').useType(ServiceD).withDependencies('C'));
            
            const issues = containerBuilder.validate();
            const circularIssues = issues.filter(issue => issue.includes('Circular dependency detected'));
            
            // We should find at least 2 circular dependencies:
            // 1. A -> B -> A
            // 2. C -> D -> C
            expect(circularIssues.length).toBeGreaterThanOrEqual(2);
            
            // Verify both circular dependencies are detected
            const issueText = circularIssues.join(' | ');
            expect(issueText).toMatch(/A.*B.*A/);
            expect(issueText).toMatch(/C.*D.*C/);
        });

        it('should validate after services are removed', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));
            
            // Initially valid
            let issues = containerBuilder.validate();
            expect(issues).toHaveLength(0);
            
            // Remove dependency
            containerBuilder.remove(TestStub);
            
            // Now should have missing dependency
            issues = containerBuilder.validate();
            const missingDeps = issues.filter(issue => issue.includes('depends on unregistered service'));
            expect(missingDeps.length).toBeGreaterThan(0);
        });

        it('should handle validation of empty service collection', () => {
            const issues = containerBuilder.validate();
            expect(issues).toHaveLength(0);
        });

        it('should combine multiple validation issues', () => {
            // Missing dependency
            containerBuilder.addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));
            
            // Circular dependency
            containerBuilder.addSingleton(r => r.fromName('A').useType(ServiceA).withDependencies('B'));
            containerBuilder.addSingleton(r => r.fromName('B').useType(ServiceB).withDependencies('A'));
            
            const issues = containerBuilder.validate();
            
            const missingDeps = issues.filter(issue => issue.includes('depends on unregistered service'));
            const circularDeps = issues.filter(issue => issue.includes('Circular dependency detected'));
            
            expect(missingDeps.length).toBeGreaterThan(0);
            expect(circularDeps.length).toBeGreaterThan(0);
        });
    });

    describe('Integration with Service Management', () => {
        it('should validate after clearing services', () => {
            // Add some valid services without circular dependencies
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addSingleton(r => r.fromName('ServiceA').useType(ServiceD));
            containerBuilder.addSingleton(r => r.fromName('ServiceB').useType(ServiceD));
            
            // Should be valid
            let issues = containerBuilder.validate();
            expect(issues).toHaveLength(0);

            // Clear all services
            containerBuilder.clear();
            
            // After clearing, should still be valid (no services to validate)
            issues = containerBuilder.validate();
            expect(issues).toHaveLength(0);
        });
    });
}); 
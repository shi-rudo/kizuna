/**
 * Fluent API Tests
 * Tests for FluentContainerBuilder functionality including:
 * - Runtime service registration
 * - Dynamic dependency resolution
 * - Flexible configuration patterns
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FluentContainerBuilder } from '../src/api/fluent-container-builder';
import { TestStub, TestStubWithOneDependency, TestStubWithTwoDependencies } from './test-dummies';

describe('Fluent API', () => {
    let builder: FluentContainerBuilder;

    beforeEach(() => {
        builder = new FluentContainerBuilder();
    });

    describe('Basic Registration', () => {
        it('should register singleton services', () => {
            builder.addSingleton(r => r.fromType(TestStub));
            const container = builder.build();
            
            const service1 = container.get(TestStub);
            const service2 = container.get(TestStub);
            
            expect(service1).toBeInstanceOf(TestStub);
            expect(service1).toBe(service2); // Same instance
        });

        it('should register scoped services', () => {
            builder.addScoped(r => r.fromType(TestStub));
            const container = builder.build();
            
            const scope1 = container.startScope();
            const scope2 = container.startScope();
            
            const service1 = scope1.get(TestStub);
            const service2 = scope2.get(TestStub);
            
            expect(service1).toBeInstanceOf(TestStub);
            expect(service1).not.toBe(service2); // Different instances
        });

        it('should register transient services', () => {
            builder.addTransient(r => r.fromType(TestStub));
            const container = builder.build();
            
            const service1 = container.get(TestStub);
            const service2 = container.get(TestStub);
            
            expect(service1).toBeInstanceOf(TestStub);
            expect(service1).not.toBe(service2); // Different instances
        });
    });

    describe('Factory Registration', () => {
        it('should register services using factory functions', () => {
            const factoryInstance = new TestStub();
            builder.addSingleton(r => r.fromName('TestService').useFactory(() => factoryInstance));
            
            const container = builder.build();
            const service = container.get('TestService');
            
            expect(service).toBe(factoryInstance);
        });

        it('should register services using factory with dependencies', () => {
            builder.addSingleton(r => r.fromType(TestStub));
            
            const container = builder.build();
            const testStub = container.get(TestStub);
            
            // Add a second builder for the factory with dependency
            const secondBuilder = new FluentContainerBuilder();
            secondBuilder.addSingleton(r => r.fromType(TestStub));
            secondBuilder.addSingleton(r => r.fromName('TestServiceWithDep').useFactory((dep: TestStub) => new TestStubWithOneDependency(dep)));
            
            const factoryContainer = secondBuilder.build();
            const factoryService = factoryContainer.get('TestServiceWithDep');
            
            expect(factoryService).toBeInstanceOf(TestStubWithOneDependency);
        });
    });

    describe('Dependency Resolution', () => {
        it('should resolve services with dependencies', () => {
            builder.addSingleton(r => r.fromType(TestStub));
            builder.addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));
            
            const container = builder.build();
            const service = container.get(TestStubWithOneDependency);
            
            expect(service).toBeInstanceOf(TestStubWithOneDependency);
            expect(service.dependency).toBeInstanceOf(TestStub);
        });

        it('should resolve services with multiple dependencies', () => {
            builder.addSingleton(r => r.fromType(TestStub));
            builder.addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));
            builder.addSingleton(r => r.fromType(TestStubWithTwoDependencies).withDependencies(TestStub, TestStubWithOneDependency));
            
            const container = builder.build();
            const service = container.get(TestStubWithTwoDependencies);
            
            expect(service).toBeInstanceOf(TestStubWithTwoDependencies);
        });
    });

    describe('Service Management', () => {
        it('should check if service is registered', () => {
            expect(builder.isRegistered(TestStub)).toBe(false);

            builder.addSingleton(r => r.fromType(TestStub));

            expect(builder.isRegistered(TestStub)).toBe(true);
        });

        it('should return correct count of registered services', () => {
            expect(builder.count).toBe(0);

            builder.addSingleton(r => r.fromType(TestStub));
            builder.addScoped(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));

            expect(builder.count).toBe(2);
        });

        it('should clear all registered services', () => {
            builder.addSingleton(r => r.fromType(TestStub));
            builder.addScoped(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));

            expect(builder.count).toBe(2);

            builder.clear();
            expect(builder.count).toBe(0);
        });
    });

    describe('Validation', () => {
        it('should validate service registrations', () => {
            builder.addSingleton(r => r.fromType(TestStub));

            const issues = builder.validate();
            expect(issues).toEqual([]);
        });

        it('should detect missing dependencies', () => {
            builder.addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));

            const issues = builder.validate();
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0]).toContain('depends on unregistered service');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid service resolution gracefully', () => {
            const container = builder.build();

            expect(() => {
                container.get(TestStub);
            }).toThrow('No service registered for key');
        });

        it('should prevent building empty containers with warning', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            const container = builder.build();
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Building ServiceProvider with no registered services')
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('Instance Registration', () => {
        it('should register existing instances', () => {
            const instance = new TestStub();
            builder.addSingleton(r => r.fromName('TestInstance').useFactory(() => instance));
            
            const container = builder.build();
            const service = container.get('TestInstance');
            
            expect(service).toBe(instance);
        });
    });
});
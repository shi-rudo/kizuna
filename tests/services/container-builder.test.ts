import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContainerBuilder } from '../../src/api/container-builder';
import { ServiceWrapper } from '../../src/core/services/service-wrapper';
import { TestStub, TestStubWithOneDependency } from '../data/test-dummies';

describe('ContainerBuilder', () => {
    let containerBuilder: ContainerBuilder;

    beforeEach(() => {
        containerBuilder = new ContainerBuilder();
    });

    describe('Error Handling', () => {
        it('should throw error when lifecycle manager is null', () => {
            expect(() => {
containerBuilder.add(null as any, r => r.fromType(TestStub));
            }).toThrow('Lifecycle manager parameter is required');
        });

        it('should throw error when service registration function is null', () => {
            expect(() => {
                containerBuilder.addSingleton(null as any);
            }).toThrow('Registration callback must be a function');
        });

        it('should handle service registration errors gracefully', () => {
            expect(() => {
                containerBuilder.addSingleton(() => {
                    throw new Error('Service registration failed');
                });
            }).toThrow('Failed to register service: Service registration failed');
        });
    });

    describe('Service Management', () => {
        it('should check if service is registered by type', () => {
            expect(containerBuilder.isRegistered(TestStub)).toBe(false);

            containerBuilder.addSingleton(r => r.fromType(TestStub));

            expect(containerBuilder.isRegistered(TestStub)).toBe(true);
        });

        it('should check if service is registered by name', () => {
            expect(containerBuilder.isRegistered('TestService')).toBe(false);

            containerBuilder.addSingleton(r => r.fromName('TestService').useType(TestStub));

            expect(containerBuilder.isRegistered('TestService')).toBe(true);
        });

        it('should return correct service count', () => {
            expect(containerBuilder.count).toBe(0);

            containerBuilder.addSingleton(r => r.fromType(TestStub));
            expect(containerBuilder.count).toBe(1);

            containerBuilder.addTransient(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));
            expect(containerBuilder.count).toBe(2);
        });

        it('should return all registered service names', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addTransient(r => r.fromName('TestService').useType(TestStubWithOneDependency).withDependencies(TestStub));

            const names = containerBuilder.getRegisteredServiceNames();
            expect(names).toContain('TestStub');
            expect(names).toContain('TestService');
            expect(names).toHaveLength(2);
        });

        it('should remove registered service', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            expect(containerBuilder.isRegistered(TestStub)).toBe(true);

            const removed = containerBuilder.remove(TestStub);
            expect(removed).toBe(true);
            expect(containerBuilder.isRegistered(TestStub)).toBe(false);
            expect(containerBuilder.count).toBe(0);
        });

        it('should return false when removing non-existent service', () => {
            const removed = containerBuilder.remove(TestStub);
            expect(removed).toBe(false);
        });

        it('should clear all registered services', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addTransient(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));

            expect(containerBuilder.count).toBe(2);

            containerBuilder.clear();

            expect(containerBuilder.count).toBe(0);
            expect(containerBuilder.isRegistered(TestStub)).toBe(false);
        });
    });

    describe('Duplicate Service Handling', () => {
        it('should warn when overwriting existing service', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addScoped(r => r.fromType(TestStub)); // Overwrite

            expect(consoleSpy).toHaveBeenCalledWith("Service 'TestStub' is already registered. Overwriting existing registration.");

            consoleSpy.mockRestore();
        });
    });

    describe('Build Validation', () => {
        it('should warn when building with no services', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            containerBuilder.build();

            expect(consoleSpy).toHaveBeenCalledWith('Building ServiceProvider with no registered services');

            consoleSpy.mockRestore();
        });

        it('should build successfully with registered services', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));

            const provider = containerBuilder.build();
            expect(provider).toBeDefined();

            const service = provider.get(TestStub);
            expect(service).toBeInstanceOf(TestStub);
        });
    });

    describe('Validation', () => {
        it('should validate registered services', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addTransient(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));

            const issues = containerBuilder.validate();
            expect(Array.isArray(issues)).toBe(true);
            // For now, no issues should be found with valid services
            expect(issues.length).toBe(0);
        });
    });

    describe('Backward Compatibility', () => {
        it('should maintain compatibility with existing usage patterns', () => {
            // Test the old usage pattern still works
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            const provider = containerBuilder.build();
            const service = provider.get(TestStub);

            expect(service).toBeInstanceOf(TestStub);
            expect(service.doSomething()).toBe(new TestStub().doSomething());
        });

        it('should work with dependency injection', () => {
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));

            const provider = containerBuilder.build();
            const service = provider.get(TestStubWithOneDependency);

            expect(service).toBeInstanceOf(TestStubWithOneDependency);
            expect(service.doSomething()).toBe(new TestStubWithOneDependency(new TestStub()).doSomething());
        });
    });

    describe('Memory Management', () => {
        it('should dispose resolvers when provider is disposed', () => {
            const disposeSpy = vi.spyOn(ServiceWrapper.prototype, 'dispose');
            
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            const provider = containerBuilder.build();

            // Verify service works
            const service = provider.get(TestStub);
            expect(service).toBeInstanceOf(TestStub);

            // Dispose provider
            provider.dispose();
            
            // Verify resolver was disposed
            expect(disposeSpy).toHaveBeenCalled();
            disposeSpy.mockRestore();
        });

        it('should dispose all resolvers when provider is disposed', () => {
            const disposeSpy = vi.spyOn(ServiceWrapper.prototype, 'dispose');
            
            containerBuilder.addSingleton(r => r.fromType(TestStub));
            containerBuilder.addTransient(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub));

            const provider = containerBuilder.build();
            
            // Get services to ensure resolvers are created
            provider.get(TestStub);
            provider.get(TestStubWithOneDependency);

            // Dispose provider
            provider.dispose();
            
            // Verify all resolvers were disposed
            // Expecting 3 calls: TestStub, TestStubWithOneDependency, and its dependency resolver
            expect(disposeSpy).toHaveBeenCalledTimes(3);
            disposeSpy.mockRestore();
        });
    });
}); 
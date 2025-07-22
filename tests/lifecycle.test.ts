/**
 * Service Lifecycle Tests
 * Tests for service lifecycle management across all APIs:
 * - Singleton behavior
 * - Scoped behavior  
 * - Transient behavior
 * - Disposal and cleanup
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { TypeSafeContainerBuilder } from '../src/api/type-safe-container-builder';
import { FluentContainerBuilder } from '../src/api/fluent-container-builder';
import { TestDummy } from './test-dummies';

describe('Service Lifecycle', () => {
    describe('Singleton Lifecycle', () => {
        it('should maintain same instance across TypeSafe API requests', () => {
            const container = new TypeSafeContainerBuilder()
                .registerSingleton('TestService', TestDummy)
                .buildTypeSafe();

            const service1 = container.get('TestService');
            const service2 = container.get('TestService');

            expect(service1).toBe(service2);
            expect(service1.getValue()).toBe(service2.getValue());
        });

        it('should maintain same instance across Fluent API requests', () => {
            const container = new FluentContainerBuilder()
                .addSingleton(r => r.fromType(TestDummy))
                .build();

            const service1 = container.get(TestDummy);
            const service2 = container.get(TestDummy);

            expect(service1).toBe(service2);
            expect(service1.getValue()).toBe(service2.getValue());
        });

        it('should share singleton instances across different scopes', () => {
            const container = new TypeSafeContainerBuilder()
                .registerSingleton('TestService', TestDummy)
                .buildTypeSafe();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const service1 = scope1.get('TestService');
            const service2 = scope2.get('TestService');

            expect(service1).toBe(service2);
        });
    });

    describe('Scoped Lifecycle', () => {
        it('should create same instance within TypeSafe API scope', () => {
            const container = new TypeSafeContainerBuilder()
                .registerScoped('TestService', TestDummy)
                .buildTypeSafe();

            const scope = container.startScope();
            const service1 = scope.get('TestService');
            const service2 = scope.get('TestService');

            expect(service1).toBe(service2);
            expect(service1.getValue()).toBe(service2.getValue());
        });

        it('should create same instance within Fluent API scope', () => {
            const container = new FluentContainerBuilder()
                .addScoped(r => r.fromType(TestDummy))
                .build();

            const scope = container.startScope();
            const service1 = scope.get(TestDummy);
            const service2 = scope.get(TestDummy);

            expect(service1).toBe(service2);
            expect(service1.getValue()).toBe(service2.getValue());
        });

        it('should create different instances in different TypeSafe API scopes', () => {
            const container = new TypeSafeContainerBuilder()
                .registerScoped('TestService', TestDummy)
                .buildTypeSafe();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const service1 = scope1.get('TestService');
            const service2 = scope2.get('TestService');

            expect(service1).not.toBe(service2);
            expect(service1.getValue()).not.toBe(service2.getValue());
        });

        it('should create different instances in different Fluent API scopes', () => {
            const container = new FluentContainerBuilder()
                .addScoped(r => r.fromType(TestDummy))
                .build();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const service1 = scope1.get(TestDummy);
            const service2 = scope2.get(TestDummy);

            expect(service1).not.toBe(service2);
            expect(service1.getValue()).not.toBe(service2.getValue());
        });
    });

    describe('Transient Lifecycle', () => {
        it('should create new instance on each TypeSafe API request', () => {
            const container = new TypeSafeContainerBuilder()
                .registerTransient('TestService', TestDummy)
                .buildTypeSafe();

            const service1 = container.get('TestService');
            const service2 = container.get('TestService');

            expect(service1).not.toBe(service2);
            expect(service1.getValue()).not.toBe(service2.getValue());
        });

        it('should create new instance on each Fluent API request', () => {
            const container = new FluentContainerBuilder()
                .addTransient(r => r.fromType(TestDummy))
                .build();

            const service1 = container.get(TestDummy);
            const service2 = container.get(TestDummy);

            expect(service1).not.toBe(service2);
            expect(service1.getValue()).not.toBe(service2.getValue());
        });

        it('should create new instances within same scope', () => {
            const container = new TypeSafeContainerBuilder()
                .registerTransient('TestService', TestDummy)
                .buildTypeSafe();

            const scope = container.startScope();
            const service1 = scope.get('TestService');
            const service2 = scope.get('TestService');

            expect(service1).not.toBe(service2);
            expect(service1.getValue()).not.toBe(service2.getValue());
        });
    });

    describe('Interface Lifecycle', () => {
        interface ITestService {
            getValue(): number;
        }

        class TestService implements ITestService {
            private static counter = 0;
            private value: number;

            constructor() {
                TestService.counter++;
                this.value = TestService.counter;
            }

            getValue(): number {
                return this.value;
            }
        }

        beforeEach(() => {
            // Reset counter for each test
            (TestService as any).counter = 0;
        });

        it('should maintain singleton behavior with interface registration', () => {
            const container = new TypeSafeContainerBuilder()
                .registerInterface<ITestService>('ITestService', TestService)
                .buildTypeSafe();

            const service1 = container.get('ITestService');
            const service2 = container.get('ITestService');

            expect(service1).toBe(service2);
            expect(service1.getValue()).toBe(1);
            expect(service2.getValue()).toBe(1);
        });

        it('should maintain scoped behavior with interface registration', () => {
            const container = new TypeSafeContainerBuilder()
                .registerScopedInterface<ITestService>('ITestService', TestService)
                .buildTypeSafe();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const service1a = scope1.get('ITestService');
            const service1b = scope1.get('ITestService');
            const service2a = scope2.get('ITestService');

            expect(service1a).toBe(service1b); // Same within scope
            expect(service1a).not.toBe(service2a); // Different across scopes
            expect(service1a.getValue()).toBe(1);
            expect(service2a.getValue()).toBe(2);
        });

        it('should maintain transient behavior with interface registration', () => {
            const container = new TypeSafeContainerBuilder()
                .registerTransientInterface<ITestService>('ITestService', TestService)
                .buildTypeSafe();

            const service1 = container.get('ITestService');
            const service2 = container.get('ITestService');

            expect(service1).not.toBe(service2);
            expect(service1.getValue()).toBe(1);
            expect(service2.getValue()).toBe(2);
        });
    });
});
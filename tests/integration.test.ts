/**
 * Integration Tests
 * Tests for cross-API functionality and integration scenarios:
 * - API comparison and compatibility
 * - Complex dependency scenarios
 * - Real-world usage patterns
 * - Builder separation validation
 */
import { describe, expect, it } from 'vitest';
import { TypeSafeContainerBuilder } from '../src/api/type-safe-container-builder';
import { FluentContainerBuilder } from '../src/api/fluent-container-builder';
import { TestStub, TestStubWithOneDependency, TestStubWithTwoDependencies } from './test-dummies';

describe('API Integration', () => {
    describe('API Separation', () => {
        it('should prevent TypeSafe builder from building Fluent containers', () => {
            const typeSafeBuilder = new TypeSafeContainerBuilder();
            
            // TypeSafe builder should not have fluent build method
            expect((typeSafeBuilder as any).build).toBeUndefined();
        });

        it('should prevent Fluent builder from building TypeSafe containers', () => {
            const fluentBuilder = new FluentContainerBuilder();
            
            // Fluent builder should not have type-safe build method
            expect((fluentBuilder as any).buildTypeSafe).toBeUndefined();
        });

        it('should have separate registration methods for each API', () => {
            const typeSafeBuilder = new TypeSafeContainerBuilder();
            const fluentBuilder = new FluentContainerBuilder();

            // TypeSafe should have register methods but not add methods
            expect(typeSafeBuilder.registerSingleton).toBeDefined();
            expect((typeSafeBuilder as any).addSingleton).toBeUndefined();

            // Fluent should have add methods but not register methods
            expect(fluentBuilder.addSingleton).toBeDefined();
            expect((fluentBuilder as any).registerSingleton).toBeUndefined();
        });
    });

    describe('Complex Dependency Resolution', () => {
        interface IComplexService {
            process(): string;
        }

        class ComplexService implements IComplexService {
            constructor(
                private stub: TestStub,
                private dependency: TestStubWithOneDependency,
                private multiDep: TestStubWithTwoDependencies
            ) {}

            process(): string {
                return `${this.stub.doSomething()}-${this.dependency.doSomething()}-${this.multiDep.doSomething()}`;
            }
        }

        it('should resolve complex TypeSafe dependency chains', () => {
            const container = new TypeSafeContainerBuilder()
                .registerSingleton('TestStub', TestStub)
                .registerSingleton('OneDep', TestStubWithOneDependency, 'TestStub')
                .registerSingleton('TwoDeps', TestStubWithTwoDependencies, 'TestStub', 'OneDep')
                .registerSingleton('ComplexService', ComplexService, 'TestStub', 'OneDep', 'TwoDeps')
                .buildTypeSafe();

            const service = container.get('ComplexService');
            const result = service.process();

            expect(result).toContain('TestStub doSomething');
            expect(result).toContain('TestStubWithOneDependency doSomething');
        });

        it('should resolve complex Fluent dependency chains', () => {
            const container = new FluentContainerBuilder()
                .addSingleton(r => r.fromType(TestStub))
                .addSingleton(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub))
                .addSingleton(r => r.fromType(TestStubWithTwoDependencies).withDependencies(TestStub, TestStubWithOneDependency))
                .addSingleton(r => r.fromType(ComplexService).withDependencies(TestStub, TestStubWithOneDependency, TestStubWithTwoDependencies))
                .build();

            const service = container.get(ComplexService);
            const result = service.process();

            expect(result).toContain('TestStub doSomething');
            expect(result).toContain('TestStubWithOneDependency doSomething');
        });

        it('should handle interface-based complex dependencies in TypeSafe API', () => {
            const container = new TypeSafeContainerBuilder()
                .registerSingleton('TestStub', TestStub)
                .registerInterface<IComplexService>('IComplexService', ComplexService, 'TestStub', 'TestStub', 'TestStub')
                .buildTypeSafe();

            const service = container.get('IComplexService');
            const result = service.process();

            expect(result).toContain('TestStub doSomething');
        });
    });

    describe('Scoped Services Integration', () => {
        it('should handle mixed singleton and scoped services in TypeSafe API', () => {
            const container = new TypeSafeContainerBuilder()
                .registerSingleton('SingletonService', TestStub)
                .registerScoped('ScopedService', TestStubWithOneDependency, 'SingletonService')
                .buildTypeSafe();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const singleton1 = scope1.get('SingletonService');
            const singleton2 = scope2.get('SingletonService');
            const scoped1 = scope1.get('ScopedService');
            const scoped2 = scope2.get('ScopedService');

            expect(singleton1).toBe(singleton2); // Singleton shared across scopes
            expect(scoped1).not.toBe(scoped2); // Scoped different across scopes
            expect(scoped1.dependency).toBe(scoped2.dependency); // Both use same singleton
        });

        it('should handle mixed singleton and scoped services in Fluent API', () => {
            const container = new FluentContainerBuilder()
                .addSingleton(r => r.fromType(TestStub))
                .addScoped(r => r.fromType(TestStubWithOneDependency).withDependencies(TestStub))
                .build();

            const scope1 = container.startScope();
            const scope2 = container.startScope();

            const singleton1 = scope1.get(TestStub);
            const singleton2 = scope2.get(TestStub);
            const scoped1 = scope1.get(TestStubWithOneDependency);
            const scoped2 = scope2.get(TestStubWithOneDependency);

            expect(singleton1).toBe(singleton2); // Singleton shared across scopes
            expect(scoped1).not.toBe(scoped2); // Scoped different across scopes
            expect(scoped1.dependency).toBe(scoped2.dependency); // Both use same singleton
        });
    });

    describe('Real-world Patterns', () => {
        // Simulating a typical application structure
        interface ILogger {
            log(message: string): void;
        }

        interface IRepository {
            save(data: any): void;
            find(id: number): any;
        }

        interface IEmailService {
            send(to: string, message: string): void;
        }

        class Logger implements ILogger {
            public messages: string[] = [];
            log(message: string): void {
                this.messages.push(message);
            }
        }

        class DatabaseRepository implements IRepository {
            constructor(private logger: ILogger) {}
            
            save(data: any): void {
                this.logger.log(`Saving data: ${JSON.stringify(data)}`);
            }
            
            find(id: number): any {
                this.logger.log(`Finding data with id: ${id}`);
                return { id, data: 'found' };
            }
        }

        class EmailService implements IEmailService {
            constructor(private logger: ILogger) {}
            
            send(to: string, message: string): void {
                this.logger.log(`Sending email to ${to}: ${message}`);
            }
        }

        class UserService {
            constructor(
                private repository: IRepository,
                private emailService: IEmailService,
                private logger: ILogger
            ) {}

            createUser(userData: any): any {
                this.logger.log('Creating user...');
                this.repository.save(userData);
                this.emailService.send(userData.email, 'Welcome!');
                return { id: 1, ...userData };
            }
        }

        it('should support typical application architecture with TypeSafe API', () => {
            const container = new TypeSafeContainerBuilder()
                .registerInterface<ILogger>('ILogger', Logger)
                .registerInterface<IRepository>('IRepository', DatabaseRepository, 'ILogger')
                .registerInterface<IEmailService>('IEmailService', EmailService, 'ILogger')
                .registerScoped('UserService', UserService, 'IRepository', 'IEmailService', 'ILogger')
                .buildTypeSafe();

            const userService = container.get('UserService');
            const result = userService.createUser({ email: 'test@example.com', name: 'John' });

            expect(result.id).toBe(1);
            expect(result.name).toBe('John');
            
            // Verify logger was used (same singleton instance across all services)
            const logger = container.get('ILogger') as unknown as Logger;
            expect(logger.messages.length).toBeGreaterThan(0);
            expect(logger.messages.some(msg => msg.includes('Creating user'))).toBe(true);
            expect(logger.messages.some(msg => msg.includes('Saving data'))).toBe(true);
            expect(logger.messages.some(msg => msg.includes('Sending email'))).toBe(true);
        });

        it('should support typical application architecture with Fluent API', () => {
            const container = new FluentContainerBuilder()
                .addSingleton(r => r.fromType(Logger))
                .addSingleton(r => r.fromType(DatabaseRepository).withDependencies(Logger))
                .addSingleton(r => r.fromType(EmailService).withDependencies(Logger))
                .addScoped(r => r.fromType(UserService).withDependencies(DatabaseRepository, EmailService, Logger))
                .build();

            const userService = container.get(UserService);
            const result = userService.createUser({ email: 'test@example.com', name: 'John' });

            expect(result.id).toBe(1);
            expect(result.name).toBe('John');
            
            // Verify logger was used
            const logger = container.get(Logger);
            expect(logger.messages.length).toBeGreaterThan(0);
            expect(logger.messages.some(msg => msg.includes('Creating user'))).toBe(true);
        });
    });
});
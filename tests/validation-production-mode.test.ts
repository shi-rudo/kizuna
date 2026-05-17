import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

class Logger {
    log(msg: string) { return msg; }
}

class UserService {
    constructor(public logger: Logger) { }
}

describe('strict parameter validation gating', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        // Reset __DEV__ in case a test set it
        delete (globalThis as { __DEV__?: boolean }).__DEV__;
    });

    describe('production mode', () => {
        beforeEach(() => {
            vi.stubEnv('NODE_ENV', 'production');
        });

        it('silently skips parameter-name mismatch detection', () => {
            const builder = new ContainerBuilder()
                .registerSingleton('Logger', Logger)
                .registerSingleton('UserService', UserService, 'WrongName'); // wrong param name

            const issues = builder.validate();
            const paramIssues = issues.filter(i => i.includes('parameter') && i.includes('named'));
            expect(paramIssues).toEqual([]);
        });

        it('still detects unregistered dependencies', () => {
            const builder = new ContainerBuilder()
                .registerSingleton('UserService', UserService, 'Logger'); // Logger not registered

            const issues = builder.validate();
            expect(issues.some(i => i.includes('unregistered'))).toBe(true);
        });

        it('still detects circular dependencies', () => {
            class A { constructor(public b: B) { } }
            class B { constructor(public a: A) { } }

            const builder = new ContainerBuilder()
                .registerSingleton('A', A, 'B')
                .registerSingleton('B', B, 'A');

            const issues = builder.validate();
            expect(issues.some(i => i.toLowerCase().includes('circular'))).toBe(true);
        });
    });

    describe('development mode (default in tests)', () => {
        it('detects parameter-name mismatches', () => {
            const builder = new ContainerBuilder()
                .registerSingleton('Logger', Logger)
                .registerSingleton('UserService', UserService, 'WrongName');

            const issues = builder.validate();
            const paramIssues = issues.filter(i => i.includes('parameter') && i.includes('named'));
            expect(paramIssues.length).toBeGreaterThan(0);
        });
    });

    describe('explicit __DEV__ override', () => {
        it('runs strict validation when __DEV__ is true even with NODE_ENV=production', () => {
            vi.stubEnv('NODE_ENV', 'production');
            (globalThis as { __DEV__?: boolean }).__DEV__ = true;

            const builder = new ContainerBuilder()
                .registerSingleton('Logger', Logger)
                .registerSingleton('UserService', UserService, 'WrongName');

            const issues = builder.validate();
            const paramIssues = issues.filter(i => i.includes('parameter') && i.includes('named'));
            expect(paramIssues.length).toBeGreaterThan(0);
        });
    });

    describe('disableStrictParameterValidation() still works', () => {
        it('opts out of validation in dev mode', () => {
            const builder = new ContainerBuilder()
                .registerSingleton('Logger', Logger)
                .registerSingleton('UserService', UserService, 'WrongName')
                .disableStrictParameterValidation();

            const issues = builder.validate();
            const paramIssues = issues.filter(i => i.includes('parameter') && i.includes('named'));
            expect(paramIssues).toEqual([]);
        });
    });
});

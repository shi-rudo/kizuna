import { describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';
import { CircularDependencyError } from '../src/api/service-provider';

class A {
    constructor(public b: unknown) {}
}
class B {
    constructor(public a: unknown) {}
}
class C {
    constructor(public b: unknown) {}
}

describe('Circular dependency detection at resolve time', () => {
    it('throws a CircularDependencyError with the dependency chain instead of overflowing the stack', () => {
        const container = new ContainerBuilder()
            .registerSingleton('a', A, 'b')
            .registerSingleton('b', B, 'a')
            .build();

        expect(() => container.get('a')).toThrowError(CircularDependencyError);

        try {
            container.get('a');
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(CircularDependencyError);
            expect((error as Error).message).toBe(
                'Circular dependency detected: a -> b -> a',
            );
        }
    });

    it('detects a direct self-dependency', () => {
        const container = new ContainerBuilder()
            .registerSingleton('a', A, 'a')
            .build();

        expect(() => container.get('a')).toThrowError(
            'Circular dependency detected: a -> a',
        );
    });

    it('detects cycles introduced through factories resolving eagerly', () => {
        const container = new ContainerBuilder()
            .registerSingletonFactory('x', (p) => p.get('y' as never))
            .registerSingletonFactory('y', (p) => p.get('x' as never))
            .build();

        expect(() => container.get('x')).toThrowError(CircularDependencyError);
    });

    it('leaves the container usable after a cycle error (resolution stack is unwound)', () => {
        class Standalone {}
        const container = new ContainerBuilder()
            .registerSingleton('a', A, 'b')
            .registerSingleton('b', B, 'a')
            .registerSingleton('ok', Standalone)
            .build();

        expect(() => container.get('a')).toThrowError(CircularDependencyError);
        // Same clean error on retry — no stale stack entries
        expect(() => container.get('a')).toThrowError(
            'Circular dependency detected: a -> b -> a',
        );
        expect(container.get('ok')).toBeInstanceOf(Standalone);
    });

    it('does not wrap the cycle error in nested "Failed to resolve" messages', () => {
        const container = new ContainerBuilder()
            .registerSingleton('a', A, 'b')
            .registerSingleton('b', B, 'a')
            .build();

        try {
            container.get('a');
            expect.unreachable('should have thrown');
        } catch (error) {
            expect((error as Error).message).not.toContain('Failed to resolve');
            expect((error as Error).message.length).toBeLessThan(200);
        }
    });
});

describe('Circular dependency detection in validate()', () => {
    it('reports a real cycle exactly once and no phantom cycles for dependents of cycle members', () => {
        const builder = new ContainerBuilder()
            .registerSingleton('a', A, 'b')
            .registerSingleton('b', B, 'a')
            .registerSingleton('c', C, 'b');

        const cycleIssues = builder
            .validate()
            .filter((issue) => issue.includes('Circular dependency'));

        expect(cycleIssues).toHaveLength(1);
        expect(cycleIssues[0]).toContain('a -> b -> a');
    });

    it('reports two independent cycles separately', () => {
        class D {
            constructor(public c: unknown) {}
        }
        class C2 {
            constructor(public d: unknown) {}
        }
        const builder = new ContainerBuilder()
            .registerSingleton('a', A, 'b')
            .registerSingleton('b', B, 'a')
            .registerSingleton('c', C2, 'd')
            .registerSingleton('d', D, 'c');

        const cycleIssues = builder
            .validate()
            .filter((issue) => issue.includes('Circular dependency'));

        expect(cycleIssues).toHaveLength(2);
    });

    it('reports no cycles for an acyclic graph', () => {
        class Leaf {}
        const builder = new ContainerBuilder()
            .registerSingleton('leaf', Leaf)
            .registerSingleton('c', C, 'leaf');

        const cycleIssues = builder
            .validate()
            .filter((issue) => issue.includes('Circular dependency'));

        expect(cycleIssues).toHaveLength(0);
    });
});

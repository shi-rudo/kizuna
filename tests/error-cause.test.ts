import { describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

const rootCause = (error: unknown): unknown => {
    let current = error;
    while (current instanceof Error && current.cause !== undefined) {
        current = current.cause;
    }
    return current;
};

describe('Resolution errors preserve the original error via cause', () => {
    it('exposes the original constructor error as the cause chain root (singleton)', () => {
        class Boom {
            constructor() {
                throw new RangeError('boom');
            }
        }
        const container = new ContainerBuilder()
            .registerSingleton('boom', Boom)
            .build();

        try {
            container.get('boom');
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('Failed to resolve service boom');
            expect((error as Error).cause).toBeInstanceOf(Error);

            const root = rootCause(error);
            expect(root).toBeInstanceOf(RangeError);
            expect((root as RangeError).message).toBe('boom');
        }
    });

    it('exposes the original factory error as the cause chain root (transient)', () => {
        const container = new ContainerBuilder()
            .registerTransientFactory('boom', () => {
                throw new TypeError('factory failed');
            })
            .build();

        try {
            container.get('boom');
            expect.unreachable('should have thrown');
        } catch (error) {
            const root = rootCause(error);
            expect(root).toBeInstanceOf(TypeError);
            expect((root as TypeError).message).toBe('factory failed');
        }
    });

    it('exposes the original error as the cause chain root for multi-registrations', () => {
        class Boom {
            constructor() {
                throw new RangeError('multi boom');
            }
        }
        const container = new ContainerBuilder()
            .addSingleton('group', Boom)
            .build();

        try {
            container.getAll('group');
            expect.unreachable('should have thrown');
        } catch (error) {
            const root = rootCause(error);
            expect(root).toBeInstanceOf(RangeError);
            expect((root as RangeError).message).toBe('multi boom');
        }
    });
});

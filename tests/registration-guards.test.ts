import { describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

class ServiceA {}
class ServiceB {}

describe('Multi-registration key validation', () => {
    it('rejects empty keys in addSingleton', () => {
        expect(() => new ContainerBuilder().addSingleton('', ServiceA)).toThrow(
            /valid name/,
        );
    });

    it('rejects whitespace-only keys in addTransient', () => {
        expect(() => new ContainerBuilder().addTransient('   ', ServiceA)).toThrow(
            /valid name/,
        );
    });

    it('rejects empty keys in addSingletonFactory', () => {
        expect(() =>
            new ContainerBuilder().addSingletonFactory('', () => new ServiceA()),
        ).toThrow(/valid name/);
    });
});

describe('Duplicate single-registration keys', () => {
    it('throws when the same key is registered twice via register*', () => {
        const builder = new ContainerBuilder().registerSingleton('svc', ServiceA);

        expect(() => builder.registerSingleton('svc', ServiceB)).toThrow(
            /already registered/,
        );
    });

    it('throws across different lifetimes for the same key', () => {
        const builder = new ContainerBuilder().registerSingleton('svc', ServiceA);

        expect(() => builder.registerScoped('svc', ServiceB)).toThrow(
            /already registered/,
        );
    });

    it('allows re-registering a key after remove()', () => {
        const builder = new ContainerBuilder().registerSingleton('svc', ServiceA);
        builder.remove('svc');

        expect(() => builder.registerSingleton('svc', ServiceB)).not.toThrow();
    });

    it('still allows appending to the same key via add*', () => {
        const builder = new ContainerBuilder()
            .addSingleton('group', ServiceA)
            .addSingleton('group', ServiceB);

        const container = builder.build();
        expect(container.getAll('group')).toHaveLength(2);
    });
});

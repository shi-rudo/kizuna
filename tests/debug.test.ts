import { describe, it, expect, vi } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

class Service1 {}
class Service2 {}
class Service3 {}

describe('Debug Method', () => {
    it('should print registered services and their lifecycles', () => {
        const container = new ContainerBuilder()
            .registerSingleton('Service1', Service1)
            .registerScoped('Service2', Service2)
            .registerTransient('Service3', Service3)
            .build();

        const spy = vi.spyOn(console, 'log');

        container.debug();

        expect(spy).toHaveBeenCalledWith('--- Registered Services ---');
        expect(spy).toHaveBeenCalledWith('Service1 -> [Singleton]');
        expect(spy).toHaveBeenCalledWith('Service2 -> [Scoped]');
        expect(spy).toHaveBeenCalledWith('Service3 -> [Transient]');
        expect(spy).toHaveBeenCalledWith('-------------------------');

        spy.mockRestore();
    });
});

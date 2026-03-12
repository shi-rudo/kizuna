import { describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

class NoDepService {
    args: any[];
    constructor(...args: any[]) {
        this.args = args;
    }
}

describe('Factory argument consistency', () => {
    it('should not pass any arguments to constructor when service has no dependencies', () => {
        const builder = new ContainerBuilder();
        const container = builder
            .registerTransient('service', NoDepService)
            .build();

        const service = container.get('service');
        expect(service.args).toEqual([]);
    });

    it('should pass serviceProvider to factory when service uses useFactory', () => {
        const builder = new ContainerBuilder();
        const container = builder
            .registerSingletonFactory('config', (provider) => {
                return { hasProvider: provider !== undefined };
            })
            .build();

        const config = container.get('config');
        expect(config.hasProvider).toBe(true);
    });
});

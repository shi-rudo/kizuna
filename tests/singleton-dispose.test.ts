import { describe, expect, it, vi } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

class DisposableService {
    disposed = false;
    dispose() {
        this.disposed = true;
    }
}

class NonDisposableService {
    value = 42;
}

describe('Singleton disposal', () => {
    it('should dispose singleton instances when root container is disposed', () => {
        const builder = new ContainerBuilder();
        const container = builder
            .registerSingleton('service', DisposableService)
            .build();

        const service = container.get('service');
        expect(service.disposed).toBe(false);

        container.dispose();
        expect(service.disposed).toBe(true);
    });

    it('should not dispose singleton when child scope is disposed', () => {
        const builder = new ContainerBuilder();
        const container = builder
            .registerSingleton('service', DisposableService)
            .build();

        const scope = container.startScope();
        const service = scope.get('service');
        expect(service.disposed).toBe(false);

        scope.dispose();
        expect(service.disposed).toBe(false);
    });

    it('should handle singletons without dispose method', () => {
        const builder = new ContainerBuilder();
        const container = builder
            .registerSingleton('service', NonDisposableService)
            .build();

        container.get('service');
        expect(() => container.dispose()).not.toThrow();
    });
});

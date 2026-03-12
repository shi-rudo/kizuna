import { describe, expect, it, vi } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';
import { ServiceProvider } from '../src/api/service-provider';

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

    it('should be safe to call dispose() twice (idempotency)', () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', DisposableService)
            .build();

        container.get('service');
        expect(() => container.dispose()).not.toThrow();
        expect(() => container.dispose()).not.toThrow();
    });

    it('should be safe to call dispose() twice on scoped container', () => {
        const container = new ContainerBuilder()
            .registerScoped('service', DisposableService)
            .build();

        const scope = container.startScope();
        scope.get('service');
        expect(() => scope.dispose()).not.toThrow();
        expect(() => scope.dispose()).not.toThrow();
    });

    it('should be safe to call dispose() twice with multi-registrations', () => {
        const container = new ContainerBuilder()
            .addSingleton('services', DisposableService)
            .addSingleton('services', NonDisposableService)
            .build();

        container.getAll('services');
        expect(() => container.dispose()).not.toThrow();
        expect(() => container.dispose()).not.toThrow();
    });
});

describe('Post-dispose behavior', () => {
    it('should throw on get() after dispose', () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', NonDisposableService)
            .build();

        container.dispose();
        expect(() => container.get('service')).toThrow(/disposed container/);
    });

    it('should throw on getAll() after dispose', () => {
        const container = new ContainerBuilder()
            .addSingleton('services', NonDisposableService)
            .build();

        container.dispose();
        expect(() => container.getAll('services')).toThrow(/disposed container/);
    });

    it('should throw on startScope() after dispose', () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', NonDisposableService)
            .build();

        container.dispose();
        expect(() => container.startScope()).toThrow(/disposed container/);
    });

    it('should throw on get() after dispose for single-reg via getAll fallback', () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', NonDisposableService)
            .build();

        container.dispose();
        expect(() => container.getAll('service')).toThrow(/disposed container/);
    });

    it('should keep child scope functional after parent dispose', () => {
        const container = new ContainerBuilder()
            .registerSingleton('singleton', NonDisposableService)
            .registerScoped('scoped', DisposableService)
            .build();

        const scope = container.startScope();
        // Resolve before parent dispose to initialize
        const scopedBefore = scope.get('scoped');

        container.dispose();

        // Child scope is independent — its own ServiceProvider with _disposed=false
        expect(() => scope.get('scoped')).not.toThrow();
        expect(scope.get('scoped')).toBe(scopedBefore); // Same scoped instance
    });

    it('should allow self-registration via get(ServiceProvider)', () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', NonDisposableService)
            .build();

        const self = container.get(ServiceProvider);
        expect(self).toBe(container);
    });

    it('should allow self-registration via get(ServiceProvider) in child scope', () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', NonDisposableService)
            .build();

        const scope = container.startScope();
        const self = scope.get(ServiceProvider);
        expect(self).toBe(scope);
    });

    it('should only dispose singleton instance once on double-dispose', () => {
        let disposeCount = 0;
        const container = new ContainerBuilder()
            .registerSingletonFactory('service', () => ({
                dispose() { disposeCount++; }
            }))
            .build();

        container.get('service');
        container.dispose();
        expect(disposeCount).toBe(1);

        container.dispose(); // Second dispose is no-op
        expect(disposeCount).toBe(1);
    });
});

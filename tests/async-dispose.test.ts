import { describe, expect, it, vi } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

class AsyncDisposableService {
    disposed = false;
    disposeCalls = 0;
    disposeResolvedAt: number | null = null;

    async dispose(): Promise<void> {
        this.disposeCalls++;
        // Simulate async cleanup (e.g. await pool.end())
        await new Promise(resolve => setTimeout(resolve, 10));
        this.disposed = true;
        this.disposeResolvedAt = Date.now();
    }
}

class SyncDisposableService {
    disposed = false;
    dispose(): void {
        this.disposed = true;
    }
}

class NonDisposableService {
    value = 42;
}

class ThrowingAsyncDisposable {
    async dispose(): Promise<void> {
        throw new Error('async dispose boom');
    }
}

describe('disposeAsync()', () => {
    it('awaits a service-owned async dispose before resolving', async () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', AsyncDisposableService)
            .build();

        const svc = container.get('service');
        expect(svc.disposed).toBe(false);

        await container.disposeAsync();
        expect(svc.disposed).toBe(true);
        expect(svc.disposeCalls).toBe(1);
    });

    it('starts independent async disposals in parallel', async () => {
        const events: string[] = [];
        let releaseFirst!: () => void;
        let releaseSecond!: () => void;
        const firstGate = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });
        const secondGate = new Promise<void>((resolve) => {
            releaseSecond = resolve;
        });
        const container = new ContainerBuilder()
            .registerSingletonFactory('a', () => ({
                async [Symbol.asyncDispose]() {
                    events.push('a:start');
                    await firstGate;
                    events.push('a:end');
                },
            }))
            .registerSingletonFactory('b', () => ({
                async [Symbol.asyncDispose]() {
                    events.push('b:start');
                    await secondGate;
                    events.push('b:end');
                },
            }))
            .build();

        container.get('a');
        container.get('b');
        const disposal = container.disposeAsync();
        await Promise.resolve();

        expect(events).toEqual(['a:start', 'b:start']);
        releaseFirst();
        releaseSecond();
        await disposal;
        expect(events).toEqual(['a:start', 'b:start', 'a:end', 'b:end']);
    });

    it('continues disposing other services before it reports a rejection', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const container = new ContainerBuilder()
            .registerSingleton('bad', ThrowingAsyncDisposable)
            .registerSingleton('good', AsyncDisposableService)
            .build();

        container.get('bad');
        const good = container.get('good');

        await expect(container.disposeAsync()).rejects.toMatchObject({
            errors: [expect.objectContaining({ message: 'async dispose boom' })],
        });
        expect(good.disposed).toBe(true);
        expect(errorSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();

        errorSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it('is idempotent — second call is a no-op', async () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', AsyncDisposableService)
            .build();

        const svc = container.get('service');
        await container.disposeAsync();
        expect(svc.disposeCalls).toBe(1);

        await container.disposeAsync();
        expect(svc.disposeCalls).toBe(1);
    });

    it('marks the container disposed (subsequent get() throws)', async () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', NonDisposableService)
            .build();

        await container.disposeAsync();
        expect(() => container.get('service')).toThrow(/disposed container/);
    });

    it('handles sync-only dispose methods correctly', async () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', SyncDisposableService)
            .build();

        const svc = container.get('service');
        await container.disposeAsync();
        expect(svc.disposed).toBe(true);
    });

    it('handles services without any dispose method', async () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', NonDisposableService)
            .build();

        container.get('service');
        await expect(container.disposeAsync()).resolves.toBeUndefined();
    });

    it('prefers Symbol.asyncDispose over every synchronous hook', async () => {
        const hooks: string[] = [];
        const container = new ContainerBuilder()
            .registerSingletonFactory('service', () => ({
                async [Symbol.asyncDispose]() {
                    hooks.push('Symbol.asyncDispose');
                },
                [Symbol.dispose]() {
                    hooks.push('Symbol.dispose');
                },
                dispose() {
                    hooks.push('dispose');
                },
            }))
            .build();

        container.get('service');
        await container.disposeAsync();
        expect(hooks).toEqual(['Symbol.asyncDispose']);
    });

    it('disposes scoped instances asynchronously', async () => {
        const container = new ContainerBuilder()
            .registerScoped('service', AsyncDisposableService)
            .build();

        const scope = container.startScope();
        const svc = scope.get('service');

        await scope.disposeAsync();
        expect(svc.disposed).toBe(true);
    });

    it('disposes multi-registrations asynchronously', async () => {
        const container = new ContainerBuilder()
            .addSingleton('services', AsyncDisposableService)
            .addSingleton('services', AsyncDisposableService)
            .build();

        const instances = container.getAll('services');
        expect(instances).toHaveLength(2);

        await container.disposeAsync();
        for (const svc of instances) {
            expect(svc.disposed).toBe(true);
        }
    });
});

describe('Symbol.dispose / Symbol.asyncDispose on container', () => {
    it('exposes Symbol.dispose as alias for dispose()', () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', SyncDisposableService)
            .build();

        const svc = container.get('service');
        (container as Disposable)[Symbol.dispose]();
        expect(svc.disposed).toBe(true);
    });

    it('exposes Symbol.asyncDispose as alias for disposeAsync()', async () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', AsyncDisposableService)
            .build();

        const svc = container.get('service');
        await (container as AsyncDisposable)[Symbol.asyncDispose]();
        expect(svc.disposed).toBe(true);
    });

    it('supports `using` syntax with sync disposal', () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', SyncDisposableService)
            .build();

        const svc = container.get('service');

        {
            using _ = container as Disposable;
            // Container in use here
        }

        expect(svc.disposed).toBe(true);
    });

    it('supports `await using` syntax with async disposal', async () => {
        const container = new ContainerBuilder()
            .registerSingleton('service', AsyncDisposableService)
            .build();

        const svc = container.get('service');

        {
            await using _ = container as AsyncDisposable;
            // Container in use here
        }

        expect(svc.disposed).toBe(true);
    });
});

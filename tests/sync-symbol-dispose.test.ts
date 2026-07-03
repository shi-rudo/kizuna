import { describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

describe('Sync dispose() honors TC39 dispose symbols', () => {
    it('disposes a singleton implementing only [Symbol.dispose]', () => {
        let disposed = false;
        class Resource {
            [Symbol.dispose]() {
                disposed = true;
            }
        }
        const container = new ContainerBuilder()
            .registerSingleton('res', Resource)
            .build();

        container.get('res');
        container.dispose();

        expect(disposed).toBe(true);
    });

    it('disposes a scoped service implementing only [Symbol.dispose] when its scope is disposed', () => {
        let disposed = false;
        class Resource {
            [Symbol.dispose]() {
                disposed = true;
            }
        }
        const container = new ContainerBuilder()
            .registerScoped('res', Resource)
            .build();

        const scope = container.startScope();
        scope.get('res');
        scope.dispose();

        expect(disposed).toBe(true);
    });

    it('prefers [Symbol.dispose] over a plain dispose() method and calls only one hook', () => {
        let symbolCalls = 0;
        let plainCalls = 0;
        class Resource {
            [Symbol.dispose]() {
                symbolCalls++;
            }
            dispose() {
                plainCalls++;
            }
        }
        const container = new ContainerBuilder()
            .registerSingleton('res', Resource)
            .build();

        container.get('res');
        container.dispose();

        expect(symbolCalls).toBe(1);
        expect(plainCalls).toBe(0);
    });

    it('falls back to [Symbol.asyncDispose] as a last resort on the sync path', () => {
        let started = false;
        class Resource {
            async [Symbol.asyncDispose]() {
                started = true;
            }
        }
        const container = new ContainerBuilder()
            .registerSingleton('res', Resource)
            .build();

        container.get('res');
        container.dispose();

        expect(started).toBe(true);
    });

    it('still supports the plain dispose() method', () => {
        let disposed = false;
        class Resource {
            dispose() {
                disposed = true;
            }
        }
        const container = new ContainerBuilder()
            .registerSingleton('res', Resource)
            .build();

        container.get('res');
        container.dispose();

        expect(disposed).toBe(true);
    });
});

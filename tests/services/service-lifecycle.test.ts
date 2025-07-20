import { describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../../src/api/container-builder';
import { TestDummy } from '../data/test-dummies';

describe('Register type using lifecycle', () => {

    it('should instantiate singleton only once', () => {
        let containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton(r => r.fromType(TestDummy));
        const provider = containerBuilder.build();

        let firstInstance = provider.get(TestDummy);
        let secondInstance = provider.get(TestDummy);
        expect(firstInstance.getValue()).to.equal(secondInstance.getValue());
    });

    it('should instantiate transient each time', () => {
        let containerBuilder = new ContainerBuilder();
        containerBuilder.addTransient(r => r.fromType(TestDummy));
        const provider = containerBuilder.build();

        let firstInstance = provider.get(TestDummy);
        let secondInstance = provider.get(TestDummy);
        expect(firstInstance.getValue()).to.not.equal(secondInstance.getValue());
    });

    it('should instantiate scoped each time scope changed', () => {
        let containerBuilder = new ContainerBuilder();
        containerBuilder.addScoped(r => r.fromType(TestDummy));
        const provider = containerBuilder.build();

        const scope1 = provider.startScope();
        let firstInstanceScope1 = scope1.get(TestDummy);
        let secondInstanceScope1 = scope1.get(TestDummy);
        expect(firstInstanceScope1.getValue()).to.equal(secondInstanceScope1.getValue());

        const scope2 = provider.startScope();
        let firstInstanceScope2 = scope2.get(TestDummy);
        let secondInstanceScope2 = scope2.get(TestDummy);
        expect(firstInstanceScope2.getValue()).to.equal(secondInstanceScope2.getValue());
        expect(firstInstanceScope1.getValue()).to.not.equal(firstInstanceScope2.getValue());
    });

    it('should instantiate scoped each time scope changed in a concurrent system', async () => {
        let containerBuilder = new ContainerBuilder();
        containerBuilder.addScoped(r => r.fromType(TestDummy));
        const provider = containerBuilder.build();

        let concurrentTask = async () => {
            return new Promise<number>((resolve) => {
                const scope = provider.startScope();
                setTimeout(() => {
                    let firstInstanceScope1 = scope.get(TestDummy);
                    scope.dispose();
                    resolve(firstInstanceScope1.getValue());
                }, 100);
            });
        }

        let allTasks: Promise<number>[] = [];
        for (let i = 0; i < 20; i++) {
            allTasks.push(concurrentTask());
        }

        await Promise.all(allTasks).then((values: number[]) => {
            const set = new Set<number>(values);
            expect(set.size).to.equal(values.length);
        });

    });

    it('should instantiate singleton only once even when scoped in a concurrent system', async () => {
        let containerBuilder = new ContainerBuilder();
        containerBuilder.addSingleton(r => r.fromType(TestDummy));
        const provider = containerBuilder.build();

        let concurrentTask = async () => {
            return new Promise<number>((resolve) => {
                const scope = provider.startScope();
                setTimeout(() => {
                    let firstInstanceScope1 = scope.get(TestDummy);
                    scope.dispose();
                    resolve(firstInstanceScope1.getValue());
                }, 100);
            });
        }

        let allTasks: Promise<number>[] = [];
        for (let i = 0; i < 20; i++) {
            allTasks.push(concurrentTask());
        }

        await Promise.all(allTasks).then((values: number[]) => {
            const set = new Set<number>(values);
            expect(set.size).to.equal(1);
        });

    });

    it('should instantiate transient each time scope changed in a concurrent system', async () => {
        let containerBuilder = new ContainerBuilder();
        containerBuilder.addTransient(r => r.fromType(TestDummy));
        const provider = containerBuilder.build();

        let concurrentTask = async () => {
            return new Promise<number>((resolve) => {
                const scope = provider.startScope();
                setTimeout(() => {
                    let firstInstanceScope1 = scope.get(TestDummy);
                    scope.dispose();
                    resolve(firstInstanceScope1.getValue());
                }, 100);
            });
        }

        let allTasks: Promise<number>[] = [];
        for (let i = 0; i < 20; i++) {
            allTasks.push(concurrentTask());
        }

        await Promise.all(allTasks).then((values: number[]) => {
            const set = new Set<number>(values);
            expect(set.size).to.equal(values.length);
        });

    });
});

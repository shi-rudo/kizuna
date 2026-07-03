import { describe, expect, it } from 'vitest';
import { ContainerBuilder } from '../src/api/container-builder';

class Dep {}
class Consumer {
    constructor(public dep: unknown) {}
}

const captiveIssues = (issues: string[]) =>
    issues.filter((issue) => issue.includes('captive dependency'));

describe('Captive dependency validation (scoped injected into singleton)', () => {
    it('flags a singleton that depends on a scoped service', () => {
        const issues = new ContainerBuilder()
            .registerScoped('dep', Dep)
            .registerSingleton('consumer', Consumer, 'dep')
            .validate();

        const captive = captiveIssues(issues);
        expect(captive).toHaveLength(1);
        expect(captive[0]).toContain("'consumer'");
        expect(captive[0]).toContain("'dep'");
    });

    it('does not flag singleton -> singleton dependencies', () => {
        const issues = new ContainerBuilder()
            .registerSingleton('dep', Dep)
            .registerSingleton('consumer', Consumer, 'dep')
            .validate();

        expect(captiveIssues(issues)).toHaveLength(0);
    });

    it('does not flag scoped -> scoped or scoped -> singleton dependencies', () => {
        const issues = new ContainerBuilder()
            .registerScoped('dep', Dep)
            .registerScoped('consumer', Consumer, 'dep')
            .validate();
        expect(captiveIssues(issues)).toHaveLength(0);

        const issues2 = new ContainerBuilder()
            .registerSingleton('dep', Dep)
            .registerScoped('consumer', Consumer, 'dep')
            .validate();
        expect(captiveIssues(issues2)).toHaveLength(0);
    });

    it('does not flag transient consumers', () => {
        const issues = new ContainerBuilder()
            .registerScoped('dep', Dep)
            .registerTransient('consumer', Consumer, 'dep')
            .validate();

        expect(captiveIssues(issues)).toHaveLength(0);
    });

    it('flags a singleton depending on a multi-registration key that contains a scoped service', () => {
        class HandlerA {}
        const issues = new ContainerBuilder()
            .addScoped('dep', HandlerA)
            .registerSingleton('consumer', Consumer, 'dep')
            .validate();

        expect(captiveIssues(issues)).toHaveLength(1);
    });

    it('flags a singleton inside a multi-registration that depends on a scoped service', () => {
        const issues = new ContainerBuilder()
            .registerScoped('dep', Dep)
            .addSingleton('group', Consumer, 'dep')
            .validate();

        const captive = captiveIssues(issues);
        expect(captive).toHaveLength(1);
        expect(captive[0]).toContain("'group'");
    });
});

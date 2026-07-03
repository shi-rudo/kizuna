import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readJson = (relativePath: string) =>
    JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

describe('Publishing metadata', () => {
    it('keeps jsr.json version in sync with package.json', () => {
        const pkg = readJson('../package.json');
        const jsr = readJson('../jsr.json');

        expect(jsr.version).toBe(pkg.version);
    });
});

// Contract of the text module sources: the bundled modules and a directory.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { textModulesFileName } from '../../src/app/reference-text';
import { TextModuleSource } from '../core/ports';
import { bundledTextModules } from './bundled-text-modules';
import { FileTextModuleSource } from './file-text-modules';

function contract(name: string, source: () => TextModuleSource): void {
    describe(`text module source contract: ${name}`, () => {
        it('serves both certificate types in both variants', () => {
            for (const type of ['abschlusszeugnis', 'zwischenzeugnis'] as const) {
                const male = source().get(type);
                const female = source().get(type, 'Frau');
                assert.ok(male.textblocks.length > 0);
                assert.ok(female.textblocks.length > 0);
                assert.equal(source().get(type, 'Herr'), male);
                // Selections by number fit both variants only if they have the same structure.
                assert.deepEqual(
                    female.textblocks.map((t) => t.name),
                    male.textblocks.map((t) => t.name),
                );
            }
        });
    });
}

contract('bundled', () => bundledTextModules);

const directory = mkdtempSync(join(tmpdir(), 'text-modules-'));
for (const type of ['abschlusszeugnis', 'zwischenzeugnis'] as const) {
    for (const salutation of ['Herr', 'Frau']) {
        const modules = bundledTextModules.get(type, salutation);
        writeFileSync(join(directory, textModulesFileName(type, salutation)), JSON.stringify(modules));
    }
}
const fromFiles = new FileTextModuleSource(directory);
contract('directory', () => fromFiles);

describe('text modules from a directory', () => {
    after(() => rmSync(directory, { recursive: true, force: true }));

    it('refuses a directory with missing files at startup', () => {
        const empty = mkdtempSync(join(tmpdir(), 'text-modules-empty-'));
        try {
            assert.throws(() => new FileTextModuleSource(empty));
        } finally {
            rmSync(empty, { recursive: true, force: true });
        }
    });
});

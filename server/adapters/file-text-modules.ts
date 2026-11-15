// Text modules from a directory of the operator, in the format and with the
// file names of src/assets (data_abschlusszeugnis.json, data_female_…).
// All four files are read and checked at startup, so a missing or broken file
// stops the start instead of the first request.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CertificateType, TextModules, textModulesFileName } from '../../src/app/reference-text';
import { TextModuleSource } from '../core/ports';

const TYPES: CertificateType[] = ['abschlusszeugnis', 'zwischenzeugnis'];
const SALUTATIONS = ['Herr', 'Frau'];

export class FileTextModuleSource implements TextModuleSource {
    private readonly files = new Map<string, TextModules>();

    constructor(directory: string) {
        for (const type of TYPES) {
            for (const salutation of SALUTATIONS) {
                const name = textModulesFileName(type, salutation);
                const modules = JSON.parse(readFileSync(join(directory, name), 'utf8')) as TextModules;
                if (!Array.isArray(modules?.textblocks)) {
                    throw new Error(`${name} has no "textblocks"`);
                }
                this.files.set(name, modules);
            }
        }
    }

    public get(certificateType: CertificateType, salutation?: string): TextModules {
        return this.files.get(textModulesFileName(certificateType, salutation)) as TextModules;
    }
}

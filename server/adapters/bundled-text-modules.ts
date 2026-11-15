// The text modules of src/assets, bundled into the backend at build time.
// They are not MIT-licensed; a fork replaces them or points TEXT_MODULES_DIR
// to its own (file-text-modules.ts).
import abschlusszeugnis from '../../src/assets/data_abschlusszeugnis.json';
import femaleAbschlusszeugnis from '../../src/assets/data_female_abschlusszeugnis.json';
import femaleZwischenzeugnis from '../../src/assets/data_female_zwischenzeugnis.json';
import zwischenzeugnis from '../../src/assets/data_zwischenzeugnis.json';
import { CertificateType, TextModules, textModulesFileName } from '../../src/app/reference-text';
import { TextModuleSource } from '../core/ports';

const FILES: Record<string, TextModules> = {
    'data_abschlusszeugnis.json': abschlusszeugnis as TextModules,
    'data_female_abschlusszeugnis.json': femaleAbschlusszeugnis as TextModules,
    'data_zwischenzeugnis.json': zwischenzeugnis as TextModules,
    'data_female_zwischenzeugnis.json': femaleZwischenzeugnis as TextModules,
};

export const bundledTextModules: TextModuleSource = {
    get: (certificateType: CertificateType, salutation?: string) =>
        FILES[textModulesFileName(certificateType, salutation)],
};

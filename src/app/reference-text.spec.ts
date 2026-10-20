import {
    TextModules,
    assembleHtml,
    assembleText,
    findPlaceholders,
    replacePlaceholders,
    textModulesFileName,
} from './reference-text';

// Minimal text modules with the structures of the real ones, independent of their wording.
const textModules: TextModules = {
    textblocks: [
        {
            name: 'intro',
            type: 'topic',
            title: '1. Einleitung',
            options: ['{firstname} {lastname} kam am {hiredate}.'],
        },
        {
            name: 'performance',
            type: 'topic',
            title: '3. Leistung',
            options: [
                {
                    name: 'work_attitude',
                    type: 'subtopic',
                    title: '3.1. Arbeitsbereitschaft',
                    options: [{ title: 'sehr gut', options: ['Sehr engagiert.'] }],
                },
                { name: 'special_successes', type: 'options', title: '3.5.', options: ['Besonderer Erfolg.'] },
            ],
        },
        {
            name: 'farewell',
            type: 'topic',
            title: '6. Dank',
            options: [{ type: 'subtopic', options: [{ title: 'sehr gut', options: ['Danke, {firstname}.'] }] }],
        },
    ],
};

describe('reference-text', () => {
    it('should pick the female text modules for the salutation "Frau"', () => {
        expect(textModulesFileName('zwischenzeugnis', 'Frau')).toBe('data_female_zwischenzeugnis.json');
        expect(textModulesFileName('zwischenzeugnis', 'Herr')).toBe('data_zwischenzeugnis.json');
        expect(textModulesFileName('abschlusszeugnis')).toBe('data_abschlusszeugnis.json');
    });

    it('should replace placeholders and label missing values', () => {
        const text = replacePlaceholders('{firstname} {lastname} ({task_list})', { firstname: 'Anna' });
        expect(text).toBe('Anna [Nachname] ([Aufgaben])');
    });

    it('should keep tokens that are no placeholders', () => {
        expect(replacePlaceholders('{department/company_part}', {})).toBe('{department/company_part}');
        expect(findPlaceholders('{a} {b} {a} {department/company_part}')).toEqual(['a', 'b']);
    });

    it('should assemble topics in template order and subtopics within a topic', () => {
        const text = assembleText(
            textModules,
            {
                farewell: { undefined: { text: 'Danke, {firstname}.', rating: 'sehr gut' } },
                performance: {
                    special_successes: { text: 'Besonderer Erfolg.', rating: '' },
                    work_attitude: { text: 'Sehr engagiert.', rating: 'sehr gut' },
                },
                intro: { option: { text: '{firstname} {lastname} kam am {hiredate}.', rating: '' } },
            },
            { firstname: 'Anna', lastname: 'Muster', hiredate: '01.02.2020' },
        );
        expect(text).toBe('Anna Muster kam am 01.02.2020.\n\nSehr engagiert. Besonderer Erfolg.\n\nDanke, Anna.');
    });

    it('should escape HTML and mark missing values in the HTML variant', () => {
        const html = assembleHtml(
            textModules,
            { intro: { option: { text: '<b>{firstname}</b> {lastname}', rating: '' } } },
            { firstname: 'A&B' },
        );
        expect(html).toBe(
            '&lt;b&gt;A&amp;B&lt;/b&gt; <span class="placeholder placeholder--lastname">[Nachname]</span>',
        );
    });
});

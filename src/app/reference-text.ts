// Framework-free assembly of the reference text from the text modules. Used by
// DataStorageService in the app and by the backend (server/), so it must not
// import Angular or browser APIs.

export type CertificateType = 'abschlusszeugnis' | 'zwischenzeugnis';

// A rating level of a subtopic, e.g. "sehr gut", with its sentences.
export interface RatingLevel {
    title: string;
    description?: string;
    options: string[];
}

// A subtopic either lists sentences directly or groups them by rating level.
// farewell and future_wishes contain a single subtopic without a name.
export interface Subtopic {
    name?: string;
    type: string;
    title?: string;
    description?: string;
    options: (string | RatingLevel)[];
    optiongroup?: string[];
}

// intro and position list sentences directly, every other topic contains subtopics.
export interface Topic {
    name: string;
    type: string;
    title: string;
    options: (string | Subtopic)[];
}

export interface TextModules {
    textblocks: Topic[];
}

export interface SelectedBlock {
    text: string;
    rating: string;
}

// Keyed by topic and subtopic name. Topics without subtopics use the key
// 'option', a subtopic without a name uses the key 'undefined'.
export type SelectedBlocks = { [topic: string]: { [subtopic: string]: SelectedBlock } };

export type FormData = { [key: string]: string | undefined };

export const PLACEHOLDER_LABELS: Readonly<Record<string, string>> = {
    salutation: 'Anrede',
    firstname: 'Vorname',
    lastname: 'Nachname',
    birthdate: 'Geburtsdatum',
    birthplace: 'Geburtsort',
    hiredate: 'Startdatum',
    enddate: 'Enddatum',
    job_title: 'Jobtitel',
    business_area: 'Geschäftsbereich',
    area_of_expertise: 'Kompetenzbereich',
    task_list: 'Aufgaben',
    projects: 'Projekte',
    sales_region: 'Verkaufsgebiet',
    promotion_date: 'Beförderungsdatum',
    department: 'Abteilung',
};

// Only names matching {\w+} are placeholders, so e.g. {department/company_part} stays verbatim.
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

// The female variants are used when the salutation "Frau" is selected.
export function textModulesFileName(certificateType: CertificateType, salutation?: string): string {
    return salutation === 'Frau' ? `data_female_${certificateType}.json` : `data_${certificateType}.json`;
}

export function placeholderLabel(key: string): string {
    return PLACEHOLDER_LABELS[key] || key;
}

// Names of all placeholders in the text, in order of appearance, without duplicates.
export function findPlaceholders(text: string): string[] {
    return [...new Set(Array.from(text.matchAll(PLACEHOLDER_PATTERN), (match) => match[1]))];
}

// Replaces placeholders with form values; missing values become "[Label]".
export function replacePlaceholders(text: string, formData: FormData): string {
    if (typeof text !== 'string') {
        return '';
    }
    return text.replace(PLACEHOLDER_PATTERN, (_, key) => formData[key] || `[${placeholderLabel(key)}]`);
}

// Like replacePlaceholders, but returns escaped HTML and marks missing values
// with a span, so the preview can link them to their form field.
export function replacePlaceholdersHtml(text: string, formData: FormData): string {
    if (typeof text !== 'string') {
        return '';
    }
    return escapeHtml(text).replace(PLACEHOLDER_PATTERN, (_, key) => {
        const value = formData[key];
        if (value) {
            return escapeHtml(value);
        }
        return `<span class="placeholder placeholder--${key}">[${placeholderLabel(key)}]</span>`;
    });
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// One paragraph per topic in the order of the text modules, with the
// subtopics of a topic joined in their template order. Placeholders stay in.
export function assembleRawTexts(
    textModules: TextModules | null | undefined,
    selectedBlocks: SelectedBlocks,
): string[] {
    const topics = textModules?.textblocks.map((t) => t.name) || Object.keys(selectedBlocks);

    return topics
        .map((topic) => {
            if (!selectedBlocks[topic]) {
                return '';
            }
            const topicBlock = textModules?.textblocks.find((block) => block.name === topic);
            const subtopicsOrder = topicBlock?.options.map((option) => subtopicKey(option)) || [];

            const subtopicTexts = subtopicsOrder
                .map((subtopic) => selectedBlocks[topic][subtopic]?.text)
                .filter((text) => text);

            if (subtopicTexts.length === 0 && topicBlock && topicBlock.options.length > 0) {
                return selectedBlocks[topic]['option']?.text || '';
            }

            return subtopicTexts.join(' ');
        })
        .filter((t) => t);
}

// Key under which a selection is stored. Mirrors the property access of the
// app (selectedBlocks[topic][subtopic.name]), which turns a missing name into
// 'undefined'; sentences listed directly in a topic have no key.
function subtopicKey(option: string | Subtopic): string {
    return typeof option === 'string' ? 'undefined' : String(option.name);
}

export function assembleText(
    textModules: TextModules | null | undefined,
    selectedBlocks: SelectedBlocks,
    formData: FormData,
): string {
    return assembleRawTexts(textModules, selectedBlocks)
        .map((t) => replacePlaceholders(t, formData))
        .join('\n\n');
}

export function assembleHtml(
    textModules: TextModules | null | undefined,
    selectedBlocks: SelectedBlocks,
    formData: FormData,
): string {
    return assembleRawTexts(textModules, selectedBlocks)
        .map((t) => replacePlaceholdersHtml(t, formData))
        .join('<br><br>');
}

// A selected sentence by number, as the backend's REST API and MCP tools use
// it. step is the name of the topic; the numbers count the sentences of a
// topic, subtopic or rating level from 0.
export interface Selection {
    step: string;
    subtopic?: string;
    rating?: string;
    sentence: number;
}

// Translates the selections of the app (text per topic and subtopic) into
// selections by number. Texts that the text modules do not contain (e.g. from
// the other variant) are counted as unmatched.
export function blocksToSelections(
    textModules: TextModules,
    selectedBlocks: SelectedBlocks,
): { selections: Selection[]; unmatched: number } {
    const selections: Selection[] = [];
    let unmatched = 0;
    const add = (selection: Omit<Selection, 'sentence'>, sentences: unknown[], text: string): void => {
        const sentence = sentences.filter((s): s is string => typeof s === 'string').indexOf(text);
        if (sentence < 0) {
            unmatched++;
        } else {
            selections.push({ ...selection, sentence });
        }
    };
    for (const topic of textModules.textblocks) {
        const blocks = selectedBlocks[topic.name] ?? {};
        const subtopics = topic.options.filter((o): o is Subtopic => typeof o !== 'string');
        if (subtopics.length === 0) {
            if (blocks['option']?.text) {
                add({ step: topic.name }, topic.options, blocks['option'].text);
            }
            continue;
        }
        for (const subtopic of subtopics) {
            const block = blocks[String(subtopic.name)];
            if (!block?.text) {
                continue;
            }
            const base: Omit<Selection, 'sentence'> = { step: topic.name };
            if (subtopic.name !== undefined) {
                base.subtopic = subtopic.name;
            }
            if (isRatedSubtopic(subtopic)) {
                const level = (subtopic.options as RatingLevel[]).find((l) => l.title === block.rating);
                if (level) {
                    add({ ...base, rating: level.title }, level.options, block.text);
                } else {
                    unmatched++;
                }
            } else {
                add(base, subtopic.options, block.text);
            }
        }
    }
    return { selections, unmatched };
}

// The reverse of blocksToSelections; selections that do not fit the text modules are left out.
export function selectionsToBlocks(textModules: TextModules, selections: Selection[]): SelectedBlocks {
    const blocks: SelectedBlocks = {};
    for (const selection of selections) {
        const topic = textModules.textblocks.find((t) => t.name === selection.step);
        if (!topic) {
            continue;
        }
        const subtopics = topic.options.filter((o): o is Subtopic => typeof o !== 'string');
        let key = 'option';
        let sentences: unknown[] = topic.options;
        if (subtopics.length > 0) {
            const subtopic = subtopics.find((s) => s.name === selection.subtopic);
            if (!subtopic) {
                continue;
            }
            key = String(subtopic.name);
            sentences = subtopic.options;
            if (isRatedSubtopic(subtopic)) {
                const level = (subtopic.options as RatingLevel[]).find((l) => l.title === selection.rating);
                sentences = level?.options ?? [];
            }
        }
        const text = sentences.filter((s): s is string => typeof s === 'string')[selection.sentence];
        if (text !== undefined) {
            blocks[topic.name] = { ...blocks[topic.name], [key]: { text, rating: selection.rating ?? '' } };
        }
    }
    return blocks;
}

function isRatedSubtopic(subtopic: Subtopic): boolean {
    return typeof subtopic.options[0] === 'object' && !!subtopic.options[0]?.title;
}

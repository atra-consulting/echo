// Agent-facing view of the text modules: a catalog with numbered sentences and
// the composition of a reference from selections by number. The assembly
// itself is the one of the app (src/app/reference-text.ts).
import abschlusszeugnis from '../src/assets/data_abschlusszeugnis.json';
import femaleAbschlusszeugnis from '../src/assets/data_female_abschlusszeugnis.json';
import femaleZwischenzeugnis from '../src/assets/data_female_zwischenzeugnis.json';
import zwischenzeugnis from '../src/assets/data_zwischenzeugnis.json';
import {
    CertificateType,
    FormData,
    PLACEHOLDER_LABELS,
    RatingLevel,
    SelectedBlocks,
    Subtopic,
    TextModules,
    assembleRawTexts,
    assembleText,
    findPlaceholders,
    placeholderLabel,
    textModulesFileName,
} from '../src/app/reference-text';

const TEXT_MODULES: Record<string, TextModules> = {
    'data_abschlusszeugnis.json': abschlusszeugnis as TextModules,
    'data_female_abschlusszeugnis.json': femaleAbschlusszeugnis as TextModules,
    'data_zwischenzeugnis.json': zwischenzeugnis as TextModules,
    'data_female_zwischenzeugnis.json': femaleZwischenzeugnis as TextModules,
};

export const DISCLAIMER =
    'Unverbindlicher Formulierungsvorschlag, keine Rechtsberatung. Bitte vor der Verwendung prüfen.';

export interface CatalogSentence {
    sentence: number;
    text: string;
}

export interface CatalogRating {
    rating: string;
    description?: string;
    sentences: CatalogSentence[];
}

export interface CatalogSubtopic {
    subtopic: string;
    title?: string;
    description?: string;
    sentences?: CatalogSentence[];
    ratings?: CatalogRating[];
}

// A topic offers sentences directly (intro, position), subtopics, or rating
// levels directly when its only subtopic has no name (farewell, future_wishes).
export interface CatalogTopic {
    topic: string;
    title: string;
    sentences?: CatalogSentence[];
    subtopics?: CatalogSubtopic[];
    ratings?: CatalogRating[];
}

export interface Selection {
    topic: string;
    subtopic?: string;
    rating?: string;
    sentence: number;
}

export interface Composition {
    text: string;
    missingPlaceholders: { name: string; label: string }[];
}

export class SelectionError extends Error {
    constructor(public readonly problems: string[]) {
        super(problems.join('\n'));
    }
}

export function loadTextModules(certificateType: CertificateType, salutation?: string): TextModules {
    return TEXT_MODULES[textModulesFileName(certificateType, salutation)];
}

export function placeholderCatalog(): { name: string; label: string }[] {
    return Object.entries(PLACEHOLDER_LABELS).map(([name, label]) => ({ name, label }));
}

export function catalog(textModules: TextModules, topic?: string): CatalogTopic[] {
    return textModules.textblocks
        .filter((t) => topic === undefined || t.name === topic)
        .map((t) => {
            const entry: CatalogTopic = { topic: t.name, title: t.title };
            const subtopics = t.options.filter((o): o is Subtopic => typeof o !== 'string');
            if (subtopics.length === 0) {
                entry.sentences = numbered(t.options as string[]);
            } else if (subtopics.length === 1 && subtopics[0].name === undefined) {
                entry.ratings = ratings(subtopics[0]);
            } else {
                entry.subtopics = subtopics.map((s) => catalogSubtopic(s));
            }
            return entry;
        });
}

function catalogSubtopic(subtopic: Subtopic): CatalogSubtopic {
    const entry: CatalogSubtopic = { subtopic: String(subtopic.name), title: subtopic.title };
    if (subtopic.description) {
        entry.description = subtopic.description;
    }
    if (isRated(subtopic)) {
        entry.ratings = ratings(subtopic);
    } else {
        entry.sentences = numbered(subtopic.options as string[]);
    }
    return entry;
}

function isRated(subtopic: Subtopic): boolean {
    return typeof subtopic.options[0] === 'object' && !!subtopic.options[0]?.title;
}

function ratings(subtopic: Subtopic): CatalogRating[] {
    return (subtopic.options as RatingLevel[]).map((level) => {
        const entry: CatalogRating = { rating: level.title, sentences: numbered(level.options) };
        if (level.description) {
            entry.description = level.description;
        }
        return entry;
    });
}

function numbered(options: string[]): CatalogSentence[] {
    return options.filter((o) => typeof o === 'string').map((text, sentence) => ({ sentence, text }));
}

// Translates the selections into the SelectedBlocks of the app, collecting
// every problem instead of stopping at the first one.
export function toSelectedBlocks(textModules: TextModules, selections: Selection[]): SelectedBlocks {
    const topics = catalog(textModules);
    const selectedBlocks: SelectedBlocks = {};
    const problems: string[] = [];

    for (const selection of selections) {
        const label = describe(selection);
        const topic = topics.find((t) => t.topic === selection.topic);
        if (!topic) {
            problems.push(`${label}: Unbekanntes Thema. Erlaubt: ${topics.map((t) => t.topic).join(', ')}.`);
            continue;
        }

        let key: string;
        let sentences: CatalogSentence[] | undefined;
        let ratingLevels: CatalogRating[] | undefined;
        if (topic.subtopics) {
            const subtopic = topic.subtopics.find((s) => s.subtopic === selection.subtopic);
            if (!subtopic) {
                const allowed = topic.subtopics.map((s) => s.subtopic).join(', ');
                problems.push(`${label}: Das Thema verlangt ein Unterthema. Erlaubt: ${allowed}.`);
                continue;
            }
            key = subtopic.subtopic;
            sentences = subtopic.sentences;
            ratingLevels = subtopic.ratings;
        } else {
            if (selection.subtopic !== undefined) {
                problems.push(`${label}: Das Thema hat keine Unterthemen.`);
                continue;
            }
            // Keys of the app: 'option' for sentences listed in the topic, 'undefined' for the unnamed subtopic.
            key = topic.sentences ? 'option' : 'undefined';
            sentences = topic.sentences;
            ratingLevels = topic.ratings;
        }

        let rating = '';
        if (ratingLevels) {
            const level = ratingLevels.find((r) => r.rating === selection.rating);
            if (!level) {
                const allowed = ratingLevels.map((r) => r.rating).join(', ');
                problems.push(`${label}: Bewertungsstufe fehlt oder ist unbekannt. Erlaubt: ${allowed}.`);
                continue;
            }
            rating = level.rating;
            sentences = level.sentences;
        } else if (selection.rating !== undefined) {
            problems.push(`${label}: Hier gibt es keine Bewertungsstufen.`);
            continue;
        }

        const sentence = sentences?.find((s) => s.sentence === selection.sentence);
        if (!sentence) {
            const last = (sentences?.length ?? 0) - 1;
            problems.push(`${label}: Satz ${selection.sentence} gibt es nicht (0 bis ${last}).`);
            continue;
        }
        if (selectedBlocks[topic.topic]?.[key]) {
            problems.push(`${label}: Pro Thema bzw. Unterthema ist nur ein Satz möglich.`);
            continue;
        }
        selectedBlocks[topic.topic] = { ...selectedBlocks[topic.topic], [key]: { text: sentence.text, rating } };
    }

    if (problems.length > 0) {
        throw new SelectionError(problems);
    }
    return selectedBlocks;
}

function describe(selection: Selection): string {
    return [selection.topic, selection.subtopic, selection.rating, `Satz ${selection.sentence}`]
        .filter((part) => part !== undefined)
        .join(' / ');
}

export function compose(textModules: TextModules, selections: Selection[], formData: FormData): Composition {
    const selectedBlocks = toSelectedBlocks(textModules, selections);
    const used = new Set(assembleRawTexts(textModules, selectedBlocks).flatMap((t) => findPlaceholders(t)));
    return {
        text: assembleText(textModules, selectedBlocks, formData),
        missingPlaceholders: [...used]
            .filter((name) => !formData[name])
            .map((name) => ({ name, label: placeholderLabel(name) })),
    };
}

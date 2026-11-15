// The guided workflow for agents, step by step ("Box für Box"): the steps are
// the topics of the text modules in their order, the same as the stepper of
// the web app. The server stays stateless; the agent keeps its selections and
// sends them along, and every composition reports what is still open.
//
// Framework-free like text-modules.ts: the REST API (http/) and the MCP tools
// (mcp/) are thin layers over these functions. Everything is derived from
// the structure of the text modules, never from their wording.
import {
    FormData,
    PLACEHOLDER_LABELS,
    SelectedBlocks,
    TextModules,
    findPlaceholders,
    replacePlaceholders,
} from '../../src/app/reference-text';
import {
    CatalogRating,
    CatalogSentence,
    CatalogSubtopic,
    CatalogTopic,
    Selection,
    catalog,
    compose,
    toSelectedBlocks,
} from './text-modules';

// How a step is filled in, derived from its structure:
// one_sentence   sentences directly in the step (intro, position)
// one_rating     rating levels directly in the step (farewell, future_wishes)
// each_subtopic  subtopics with rating levels; one rating and sentence for each,
//                subtopics without rating levels are optional (performance, behavior_evaluation)
// one_subtopic   only subtopics without rating levels, which are alternatives (conclusion)
export type SelectionRule = 'one_sentence' | 'one_rating' | 'each_subtopic' | 'one_subtopic';

const HINTS: Record<SelectionRule, string> = {
    one_sentence: 'Einen Satz wählen.',
    one_rating: 'Zuerst die Bewertungsstufe wählen, die zur Person passt, dann einen Satz dieser Stufe.',
    each_subtopic:
        'Für jedes Unterthema mit Bewertungsstufen eine Stufe und einen Satz dieser Stufe wählen. Unterthemen ' +
        'ohne Bewertungsstufen (optional: true) nur, wenn sie zutreffen.',
    one_subtopic: 'Das eine Unterthema wählen, das zur Situation passt, und daraus einen Satz.',
};

// Short descriptions of the steps of the shipped text modules; other steps fall back to their title.
const DESCRIPTIONS: Record<string, string> = {
    intro: 'Einleitung: Person, Eintritt und Funktion',
    position: 'Position, Aufgaben und Verantwortungsbereiche',
    performance: 'Leistungsbeurteilung in mehreren Unterthemen',
    behavior_evaluation: 'Verhalten gegenüber Vorgesetzten, Kollegen und Dritten sowie soziales Verhalten',
    conclusion: 'Grund der Beendigung bzw. Anlass des Zwischenzeugnisses',
    farewell: 'Schlussformel mit Dank (und beim Abschlusszeugnis Bedauern)',
    future_wishes: 'Wünsche für die Zukunft',
};

export interface StepSummary {
    step: string;
    title: string;
    description: string;
    // Every step belongs to a complete reference; the selection rule says what completes it.
    required: boolean;
    selection_rule: SelectionRule;
    hint: string;
}

export interface StepSubtopic extends CatalogSubtopic {
    optional: boolean;
}

export interface StepBox extends StepSummary {
    position: number;
    of: number;
    previous_step: string | null;
    next_step: string | null;
    sentences?: CatalogSentence[];
    ratings?: CatalogRating[];
    subtopics?: StepSubtopic[];
}

export interface PersonField {
    name: string;
    label: string;
    // Steps whose sentences contain the placeholder; the salutation also selects the text variant.
    used_in_steps: string[];
}

// A selected sentence with its current wording (placeholders replaced).
export interface SelectedSentence {
    subtopic?: string;
    rating?: string;
    sentence: number;
    text: string;
}

export interface StepStatus {
    step: string;
    title: string;
    status: 'complete' | 'partial' | 'open';
    // each_subtopic: the subtopics with rating levels that still lack a selection
    open_subtopics?: string[];
    // Only in a draft: the sentences selected in this step, in template order.
    selected?: SelectedSentence[];
}

export interface Progress {
    steps: StepStatus[];
    open_steps: string[];
    next_step: string | null;
    complete: boolean;
}

export interface Start {
    steps: StepSummary[];
    person_fields: PersonField[];
    first_step: StepBox | null;
}

export interface Draft extends Progress {
    text: string;
    missing_placeholders: { name: string; label: string }[];
}

function selectionRule(topic: CatalogTopic): SelectionRule {
    if (topic.sentences) {
        return 'one_sentence';
    }
    if (topic.ratings) {
        return 'one_rating';
    }
    return topic.subtopics?.some((s) => s.ratings) ? 'each_subtopic' : 'one_subtopic';
}

function summary(topic: CatalogTopic): StepSummary {
    const rule = selectionRule(topic);
    return {
        step: topic.topic,
        title: topic.title,
        description: DESCRIPTIONS[topic.topic] ?? topic.title,
        required: true,
        selection_rule: rule,
        hint: HINTS[rule],
    };
}

export function stepSummaries(textModules: TextModules): StepSummary[] {
    return catalog(textModules).map(summary);
}

// One step with its sentences, rating levels or subtopics; undefined for an unknown step.
export function stepBox(textModules: TextModules, step: string): StepBox | undefined {
    const topics = catalog(textModules);
    const index = topics.findIndex((t) => t.topic === step);
    if (index < 0) {
        return undefined;
    }
    const topic = topics[index];
    const box: StepBox = {
        ...summary(topic),
        position: index + 1,
        of: topics.length,
        previous_step: topics[index - 1]?.topic ?? null,
        next_step: topics[index + 1]?.topic ?? null,
    };
    if (topic.sentences) {
        box.sentences = topic.sentences;
    }
    if (topic.ratings) {
        box.ratings = topic.ratings;
    }
    if (topic.subtopics) {
        const rule = box.selection_rule;
        box.subtopics = topic.subtopics.map((s) => ({ ...s, optional: rule === 'each_subtopic' && !s.ratings }));
    }
    return box;
}

export function stepIds(textModules: TextModules): string[] {
    return textModules.textblocks.map((t) => t.name);
}

// The person fields that occur in the text modules, with the steps they occur in.
export function personFields(textModules: TextModules): PersonField[] {
    const steps = new Map<string, Set<string>>();
    for (const topic of catalog(textModules)) {
        for (const text of sentenceTexts(topic)) {
            for (const name of findPlaceholders(text)) {
                steps.set(name, (steps.get(name) ?? new Set()).add(topic.topic));
            }
        }
    }
    return Object.entries(PLACEHOLDER_LABELS)
        .filter(([name]) => name === 'salutation' || steps.has(name))
        .map(([name, label]) => ({ name, label, used_in_steps: [...(steps.get(name) ?? [])] }));
}

function sentenceTexts(topic: CatalogTopic): string[] {
    const ratings = (r?: CatalogRating[]): string[] => (r ?? []).flatMap((l) => l.sentences.map((s) => s.text));
    return [
        ...(topic.sentences ?? []).map((s) => s.text),
        ...ratings(topic.ratings),
        ...(topic.subtopics ?? []).flatMap((s) => [...(s.sentences ?? []).map((x) => x.text), ...ratings(s.ratings)]),
    ];
}

export function start(textModules: TextModules): Start {
    const steps = stepSummaries(textModules);
    return {
        steps: steps,
        person_fields: personFields(textModules),
        first_step: steps.length > 0 ? (stepBox(textModules, steps[0].step) ?? null) : null,
    };
}

// What is complete, what is still open and which step comes next, for
// selections in the format of the app (see toSelectedBlocks).
export function progress(textModules: TextModules, selectedBlocks: SelectedBlocks): Progress {
    const steps = catalog(textModules).map((topic): StepStatus => {
        const selected = selectedBlocks[topic.topic] ?? {};
        const any = Object.values(selected).some((block) => block?.text);
        const base = { step: topic.topic, title: topic.title };
        if (selectionRule(topic) !== 'each_subtopic') {
            return { ...base, status: any ? 'complete' : 'open' };
        }
        const open = (topic.subtopics ?? [])
            .filter((s) => s.ratings && !selected[s.subtopic]?.text)
            .map((s) => s.subtopic);
        const status = open.length === 0 ? 'complete' : any ? 'partial' : 'open';
        return { ...base, status, open_subtopics: open };
    });
    const openSteps = steps.filter((s) => s.status !== 'complete').map((s) => s.step);
    return {
        steps: steps,
        open_steps: openSteps,
        next_step: openSteps[0] ?? null,
        complete: openSteps.length === 0,
    };
}

// Composes the text from partial or complete selections and reports the
// progress, with the current wording of every selected sentence per step, so
// the agent can show the state at any point. Throws a SelectionError for
// invalid selections.
export function draft(textModules: TextModules, selections: Selection[], formData: FormData): Draft {
    const composition = compose(textModules, selections, formData);
    const result = progress(textModules, toSelectedBlocks(textModules, selections));
    const topics = catalog(textModules);
    for (const status of result.steps) {
        const order = topics.find((t) => t.topic === status.step)?.subtopics?.map((s) => s.subtopic) ?? [];
        status.selected = selections
            .filter((selection) => selection.step === status.step)
            .sort((a, b) => order.indexOf(a.subtopic ?? '') - order.indexOf(b.subtopic ?? ''))
            .map((selection) => selectedSentence(textModules, selection, formData));
    }
    return { text: composition.text, missing_placeholders: composition.missingPlaceholders, ...result };
}

function selectedSentence(textModules: TextModules, selection: Selection, formData: FormData): SelectedSentence {
    const blocks = toSelectedBlocks(textModules, [selection])[selection.step];
    const text = Object.values(blocks)[0].text;
    const entry: SelectedSentence = { sentence: selection.sentence, text: replacePlaceholders(text, formData) };
    if (selection.subtopic !== undefined) {
        entry.subtopic = selection.subtopic;
    }
    if (selection.rating !== undefined) {
        entry.rating = selection.rating;
    }
    return entry;
}

// Input schemas shared by the REST API (http/) and the MCP tools (mcp/), so
// both validate the same way and the OpenAPI description matches the tools.
import * as z from 'zod/v4';
import { PLACEHOLDER_LABELS } from '../../src/app/reference-text';

export const CERTIFICATE_TYPES = [
    {
        id: 'abschlusszeugnis',
        title: 'Abschlusszeugnis',
        description: 'Zeugnis zum Ende des Arbeitsverhältnisses',
    },
    {
        id: 'zwischenzeugnis',
        title: 'Zwischenzeugnis',
        description: 'Zeugnis während des laufenden Arbeitsverhältnisses',
    },
] as const;

export const certificateType = z
    .enum(['abschlusszeugnis', 'zwischenzeugnis'])
    .describe('Zeugnisart: Abschlusszeugnis (Ende des Arbeitsverhältnisses) oder Zwischenzeugnis');

export const salutation = z.enum(['Herr', 'Frau']).describe('Anrede; "Frau" wählt die weibliche Textvariante');

export const step = z.string().describe('Id des Schritts, z. B. "performance" (Reihenfolge siehe Schrittliste)');

const formDataShape = Object.fromEntries(
    Object.entries(PLACEHOLDER_LABELS)
        .filter(([name]) => name !== 'salutation')
        .map(([name, label]) => [name, z.string().optional().describe(label)]),
) as Record<string, z.ZodOptional<z.ZodString>>;

export const formData = z
    .object({ salutation: salutation.optional(), ...formDataShape })
    .describe(
        'Angaben zur Person, die die Platzhalter ersetzen. Die Anrede wählt die Textvariante und muss zu den ' +
            'abgerufenen Schritten passen. Datumsangaben im Format TT.MM.JJJJ.',
    );

export const selection = z.object({
    step: step,
    subtopic: z.string().optional().describe('Unterthema, wenn der Schritt Unterthemen hat'),
    rating: z.string().optional().describe('Bewertungsstufe, wenn der Schritt bzw. das Unterthema Stufen hat'),
    sentence: z.number().int().min(0).describe('Nummer des Satzes aus dem Schritt'),
});

export const selections = z
    .array(selection)
    .describe('Bisher gewählte Sätze aller Schritte; eine leere oder unvollständige Auswahl ist erlaubt');

// The state of a reference as the client keeps it: certificate type, person
// fields (the salutation among them selects the text variant) and the
// selections of all steps. Body of POST /api/references and PUT
// /api/drafts/{id}, content of a stored draft and of its export. Versioned
// (schema_version); owner, status, revision and timestamps of a stored draft
// belong next to it, not into it.
export const REFERENCE_DRAFT_VERSION = 1;

export const referenceDraftShape = {
    schema_version: z
        .literal(REFERENCE_DRAFT_VERSION)
        .optional()
        .describe(`Version dieses Formats, derzeit ${REFERENCE_DRAFT_VERSION}`),
    certificate_type: certificateType,
    form_data: formData,
    selections: selections,
};

export const referenceDraft = z.object(referenceDraftShape);

// Creating a draft needs only the certificate type; the rest can follow step by step.
export const newDraft = referenceDraft.extend({
    form_data: formData.default({}),
    selections: selections.default([]),
});

export const placeholder = z.object({ name: z.string(), label: z.string() });

const stepStatus = z.object({
    step: z.string(),
    title: z.string(),
    status: z.enum(['complete', 'partial', 'open']),
    open_subtopics: z.array(z.string()).optional(),
    selected: z
        .array(
            z.object({
                subtopic: z.string().optional(),
                rating: z.string().optional(),
                sentence: z.number(),
                text: z.string().describe('Aktueller Wortlaut mit ersetzten Platzhaltern'),
            }),
        )
        .optional(),
});

export const draftResult = z.object({
    text: z.string().describe('Zeugnistext aus den bisher gewählten Sätzen'),
    missing_placeholders: z.array(placeholder).describe('Angaben, die im Text noch als [Bezeichnung] stehen'),
    steps: z.array(stepStatus),
    open_steps: z.array(z.string()),
    next_step: z.string().nullable().describe('Nächster offener Schritt; null, wenn alle Schritte erledigt sind'),
    complete: z.boolean(),
    disclaimer: z.string(),
});

// The person fields are generated from PLACEHOLDER_LABELS, so their names are only known at runtime.
export type FormFields = { [name: string]: string | undefined; salutation?: 'Herr' | 'Frau' };

export type ReferenceDraft = Omit<z.infer<typeof referenceDraft>, 'form_data'> & { form_data: FormFields };

// Selections of one step for update_draft / PATCH /api/drafts/{id}; the step is given once.
export const stepSelection = selection.omit({ step: true });

export const draftPatch = z.object({
    form_data: formData
        .partial()
        .optional()
        .describe('Geänderte Angaben zur Person; nicht genannte Felder bleiben, ein leerer Text löscht ein Feld'),
    step: step.optional().describe('Schritt, dessen Auswahl ersetzt wird'),
    selections: z
        .array(stepSelection)
        .optional()
        .describe('Neue Auswahl dieses Schritts (ersetzt die bisherige; leer = Auswahl des Schritts löschen)'),
});

export type DraftPatch = Omit<z.infer<typeof draftPatch>, 'form_data'> & { form_data?: Partial<FormFields> };

export const EXPORT_FORMAT = 'zeugnisgenerator-reference';

// JSON export of a stored draft: no owner, no internal id. Plaintext on purpose,
// the user downloads it.
export const draftExport = z.object({
    format: z.literal(EXPORT_FORMAT),
    schema_version: z.literal(REFERENCE_DRAFT_VERSION),
    status: z.enum(['draft', 'final']),
    exported_at: z.string(),
    draft: referenceDraft,
});

export type DraftExport = z.infer<typeof draftExport>;

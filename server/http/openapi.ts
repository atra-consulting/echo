// OpenAPI description of the REST API, served at /api/openapi.json. The
// request schemas are generated from the zod schemas the API validates with.
import * as z from 'zod/v4';
import { version } from '../../package.json';
import { DISCLAIMER } from '../core/text-modules';
import {
    certificateType,
    draftExport,
    draftPatch,
    draftResult,
    newDraft,
    placeholder,
    referenceDraft,
    salutation,
} from '../core/schemas';

let document: object | undefined;

export function openApiDocument(): object {
    document ??= build();
    return document;
}

function schema(type: z.ZodType, io: 'input' | 'output' = 'output'): Record<string, unknown> {
    const { $schema: _, ...rest } = z.toJSONSchema(type, { target: 'draft-2020-12', io: io });
    return rest;
}

const error = {
    type: 'object',
    required: ['error'],
    properties: {
        error: {
            type: 'object',
            required: ['code', 'message'],
            properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} },
        },
    },
};

const disclaimer = { type: 'string', description: 'Hinweis: keine Rechtsberatung' };

function json(description: string, ref: string): object {
    return { description, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } };
}

const errorResponse = (description: string): object => json(description, 'Error');

const typeParameter = {
    name: 'type',
    in: 'path',
    required: true,
    schema: { $ref: '#/components/schemas/CertificateType' },
};

const salutationParameter = {
    name: 'salutation',
    in: 'query',
    required: false,
    description: 'Anrede; "Frau" wählt die weibliche Textvariante. Standard: Herr.',
    schema: { $ref: '#/components/schemas/Salutation' },
};

const idParameter = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };

function body(ref: string): object {
    return { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } };
}

const stepParameter = {
    name: 'step',
    in: 'path',
    required: true,
    description: 'Id des Schritts aus der Schrittliste, z. B. "performance"',
    schema: { type: 'string' },
};

const variant = {
    certificate_type: { $ref: '#/components/schemas/CertificateType' },
    salutation: { $ref: '#/components/schemas/Salutation' },
};

const sentences = { type: 'array', items: { $ref: '#/components/schemas/Sentence' } };
const ratings = { type: 'array', items: { $ref: '#/components/schemas/Rating' } };

const stepSummary = {
    step: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    required: { type: 'boolean' },
    selection_rule: {
        enum: ['one_sentence', 'one_rating', 'each_subtopic', 'one_subtopic'],
        description:
            'one_sentence: einen Satz wählen. one_rating: eine Bewertungsstufe und einen Satz daraus. ' +
            'each_subtopic: für jedes Unterthema mit Stufen eine Stufe und einen Satz, Unterthemen mit ' +
            'optional: true nur bei Bedarf. one_subtopic: das eine passende Unterthema und daraus einen Satz.',
    },
    hint: { type: 'string' },
};

function build(): object {
    return {
        openapi: '3.1.0',
        info: {
            title: 'Zeugnisgenerator API',
            version: version,
            description:
                'Setzt deutsche Arbeitszeugnisse (Abschlusszeugnis, Zwischenzeugnis) aus vorformulierten ' +
                'Textbausteinen zusammen, Schritt für Schritt wie die Web-App und wie die MCP-Tools. Ablauf mit ' +
                'gespeichertem Entwurf (wie die MCP-Tools, Anmeldung über IAP): 1. POST /api/drafts legt ihn an. ' +
                '2. GET /api/drafts/{id}/steps/{step} liefert einen Schritt mit nummerierten Sätzen. 3. PATCH ' +
                '/api/drafts/{id} speichert die Auswahl eines Schritts (bei Bewertungsstufen zuerst die Stufe) und ' +
                'liefert Text bis hierher, offene Schritte und next_step. 4. Wiederholen, bis complete true ist; ' +
                'auf Wunsch POST /api/drafts/{id}/finalize. Ohne Speichern: GET /api/certificate-types/{type}/steps ' +
                'und POST /api/references. ' +
                `${DISCLAIMER} Das Ergebnis ist nie rechtssicher oder geprüft.`,
        },
        servers: [{ url: '/' }],
        paths: {
            '/api/health': {
                get: {
                    operationId: 'health',
                    summary: 'Betriebsbereitschaft',
                    responses: { '200': json('Der Dienst läuft.', 'Health') },
                },
            },
            '/api/certificate-types': {
                get: {
                    operationId: 'listCertificateTypes',
                    summary: 'Zeugnisarten und Anreden',
                    responses: { '200': json('Zeugnisarten', 'CertificateTypes') },
                },
            },
            '/api/certificate-types/{type}/steps': {
                get: {
                    operationId: 'startReference',
                    summary: 'Schritte, Angaben zur Person und erster Schritt, ohne Entwurf',
                    parameters: [typeParameter, salutationParameter],
                    responses: {
                        '200': json('Schritte', 'Start'),
                        '400': errorResponse('Ungültige Parameter'),
                        '404': errorResponse('Unbekannte Zeugnisart'),
                    },
                },
            },
            '/api/certificate-types/{type}/steps/{step}': {
                get: {
                    operationId: 'getStep',
                    summary: 'Einen Schritt mit nummerierten Sätzen abrufen, ohne Entwurf',
                    parameters: [typeParameter, stepParameter, salutationParameter],
                    responses: {
                        '200': json('Schritt', 'Step'),
                        '400': errorResponse('Ungültige Parameter'),
                        '404': errorResponse('Unbekannte Zeugnisart oder unbekannter Schritt'),
                    },
                },
            },
            '/api/references': {
                post: {
                    operationId: 'composeReference',
                    summary: 'Zeugnistext aus einer (auch unvollständigen) Auswahl, ohne zu speichern',
                    description:
                        'Setzt die gewählten Sätze in der Reihenfolge der Schritte zusammen und ersetzt die ' +
                        'Platzhalter. Eine leere oder unvollständige Auswahl ist erlaubt; steps[].selected nennt ' +
                        'je Schritt die gewählten Sätze im aktuellen Wortlaut. Pro Schritt bzw. Unterthema ist ein ' +
                        'Satz möglich. Fehlende Angaben erscheinen als [Bezeichnung]. Es wird nichts gespeichert.',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ReferenceDraft' } } },
                    },
                    responses: {
                        '200': json('Text bis hierher und Fortschritt', 'Draft'),
                        '400': errorResponse('Ungültige Anfrage (Schema)'),
                        '422': errorResponse('Ungültige Auswahl; details listet alle Probleme'),
                    },
                },
            },
            '/api/drafts': {
                get: {
                    operationId: 'listDrafts',
                    summary: 'Eigene Entwürfe, neueste zuerst (MCP list_drafts)',
                    responses: {
                        '200': json('Entwürfe und Aufbewahrungsfrist in Tagen', 'DraftList'),
                        '401': errorResponse('Keine Anmeldung'),
                        '404': errorResponse('Entwürfe sind nicht aktiviert (drafts_disabled)'),
                    },
                },
                post: {
                    operationId: 'createDraft',
                    summary: 'Entwurf anlegen (MCP create_draft)',
                    requestBody: body('NewDraft'),
                    responses: {
                        '201': json('Angelegter Entwurf', 'DraftView'),
                        '400': errorResponse('Ungültige Anfrage'),
                        '422': errorResponse('Ungültige Auswahl'),
                    },
                },
            },
            '/api/drafts/import': {
                post: {
                    operationId: 'importDraft',
                    summary: 'Export als neuen, bearbeitbaren Entwurf anlegen (MCP import_draft)',
                    requestBody: body('DraftExport'),
                    responses: {
                        '201': json('Neuer Entwurf', 'DraftView'),
                        '400': errorResponse('Kein gültiger Export'),
                        '422': errorResponse('Ungültige Auswahl'),
                    },
                },
            },
            '/api/drafts/{id}': {
                parameters: [idParameter],
                get: {
                    operationId: 'getDraft',
                    summary: 'Entwurf mit Text bis hierher und Fortschritt (MCP get_draft)',
                    responses: { '200': json('Entwurf', 'DraftView'), '404': errorResponse('Nicht gefunden') },
                },
                put: {
                    operationId: 'replaceDraft',
                    summary: 'Entwurf vollständig ersetzen (Web-App)',
                    requestBody: body('ReferenceDraft'),
                    responses: {
                        '200': json('Entwurf', 'DraftView'),
                        '404': errorResponse('Nicht gefunden'),
                        '409': errorResponse('Entwurf ist final'),
                        '422': errorResponse('Ungültige Auswahl'),
                    },
                },
                patch: {
                    operationId: 'updateDraft',
                    summary: 'Angaben zur Person und/oder die Auswahl eines Schritts ändern (MCP update_draft)',
                    requestBody: body('DraftPatch'),
                    responses: {
                        '200': json('Entwurf', 'DraftView'),
                        '404': errorResponse('Nicht gefunden'),
                        '409': errorResponse('Entwurf ist final'),
                        '422': errorResponse('Ungültige Auswahl'),
                    },
                },
                delete: {
                    operationId: 'deleteDraft',
                    summary: 'Entwurf löschen',
                    responses: { '204': { description: 'Gelöscht' }, '404': errorResponse('Nicht gefunden') },
                },
            },
            '/api/drafts/{id}/steps/{step}': {
                get: {
                    operationId: 'getDraftStep',
                    summary: 'Einen Schritt in der Textvariante des Entwurfs mit dessen Auswahl (MCP get_step)',
                    parameters: [idParameter, stepParameter],
                    responses: {
                        '200': json('Schritt', 'DraftStep'),
                        '404': errorResponse('Entwurf oder Schritt nicht gefunden'),
                    },
                },
            },
            '/api/drafts/{id}/finalize': {
                post: {
                    operationId: 'finalizeDraft',
                    summary: 'Als final markieren; danach schreibgeschützt (MCP finalize_draft)',
                    parameters: [idParameter],
                    responses: { '200': json('Entwurf', 'DraftView'), '404': errorResponse('Nicht gefunden') },
                },
            },
            '/api/drafts/{id}/export': {
                get: {
                    operationId: 'exportDraft',
                    summary: 'Als JSON-Datenobjekt exportieren, ohne Besitzer und interne Id (MCP export_draft)',
                    parameters: [idParameter],
                    responses: { '200': json('Export', 'DraftExport'), '404': errorResponse('Nicht gefunden') },
                },
            },
            '/api/certificate-types/{type}/text-modules': {
                get: {
                    operationId: 'getTextModules',
                    summary: 'Alle Textbausteine in der Struktur der Vorlagen (für die Web-App)',
                    parameters: [typeParameter, salutationParameter],
                    responses: {
                        '200': json('Textbausteine', 'TextModules'),
                        '400': errorResponse('Ungültige Parameter'),
                        '404': errorResponse('Unbekannte Zeugnisart'),
                    },
                },
            },
        },
        components: {
            schemas: {
                CertificateType: schema(certificateType),
                Salutation: schema(salutation),
                Placeholder: schema(placeholder),
                ReferenceDraft: schema(referenceDraft, 'input'),
                NewDraft: schema(newDraft, 'input'),
                DraftPatch: schema(draftPatch, 'input'),
                DraftExport: schema(draftExport),
                DraftSummary: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        status: { enum: ['draft', 'final'] },
                        certificate_type: { $ref: '#/components/schemas/CertificateType' },
                        title: { type: 'string', description: 'Name der Person' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                        expire_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Löschung nach der Aufbewahrungsfrist; jede Änderung verschiebt sie',
                        },
                    },
                },
                DraftList: {
                    type: 'object',
                    properties: {
                        drafts: { type: 'array', items: { $ref: '#/components/schemas/DraftSummary' } },
                        retention_days: { type: 'integer' },
                        disclaimer: disclaimer,
                    },
                },
                DraftView: {
                    allOf: [
                        { $ref: '#/components/schemas/DraftSummary' },
                        {
                            type: 'object',
                            properties: {
                                draft: { $ref: '#/components/schemas/ReferenceDraft' },
                                result: { $ref: '#/components/schemas/Draft' },
                            },
                        },
                    ],
                },
                DraftStep: {
                    allOf: [
                        { $ref: '#/components/schemas/Step' },
                        {
                            type: 'object',
                            properties: {
                                draft_id: { type: 'string' },
                                current: { type: 'object', description: 'Stand und Auswahl des Entwurfs im Schritt' },
                                open_steps: { type: 'array', items: { type: 'string' } },
                            },
                        },
                    ],
                },
                Draft: schema(draftResult),
                Error: error,
                Health: {
                    type: 'object',
                    properties: { status: { const: 'ok' }, version: { type: 'string' } },
                },
                CertificateTypes: {
                    type: 'object',
                    properties: {
                        certificate_types: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { $ref: '#/components/schemas/CertificateType' },
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                },
                            },
                        },
                        salutations: { type: 'array', items: { $ref: '#/components/schemas/Salutation' } },
                        disclaimer: disclaimer,
                    },
                },
                Sentence: {
                    type: 'object',
                    properties: { sentence: { type: 'integer' }, text: { type: 'string' } },
                },
                Rating: {
                    type: 'object',
                    properties: { rating: { type: 'string' }, description: { type: 'string' }, sentences: sentences },
                },
                StepSummary: { type: 'object', properties: stepSummary },
                Step: {
                    type: 'object',
                    description: 'Ein Schritt hat sentences, ratings oder subtopics.',
                    properties: {
                        ...variant,
                        ...stepSummary,
                        position: { type: 'integer' },
                        of: { type: 'integer' },
                        previous_step: { type: ['string', 'null'] },
                        next_step: { type: ['string', 'null'] },
                        sentences: sentences,
                        ratings: ratings,
                        subtopics: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    subtopic: { type: 'string' },
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    optional: { type: 'boolean' },
                                    sentences: sentences,
                                    ratings: ratings,
                                },
                            },
                        },
                        disclaimer: disclaimer,
                    },
                },
                Start: {
                    type: 'object',
                    properties: {
                        ...variant,
                        steps: { type: 'array', items: { $ref: '#/components/schemas/StepSummary' } },
                        person_fields: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    label: { type: 'string' },
                                    used_in_steps: { type: 'array', items: { type: 'string' } },
                                },
                            },
                        },
                        first_step: { $ref: '#/components/schemas/Step' },
                        disclaimer: disclaimer,
                    },
                },
                TextModules: {
                    type: 'object',
                    properties: {
                        ...variant,
                        textblocks: { type: 'array', items: { type: 'object' } },
                        disclaimer: disclaimer,
                    },
                },
            },
        },
    };
}

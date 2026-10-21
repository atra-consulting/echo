// MCP tools of the guided, draft-based workflow: a thin layer over DraftService
// (core/drafts.ts) and core/steps.ts, like the REST API. The draft is stored per user;
// the owner comes from the verified identity of the request.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { version } from '../../package.json';
import {
    DraftConflictError,
    DraftFinalError,
    DraftNotFoundError,
    DraftPatchError,
    DraftService,
    UnknownStepError,
} from '../core/drafts';
import { certificateType, draftExport, draftPatch, formData, salutation, step } from '../core/schemas';
import { start } from '../core/steps';
import { TextModuleSource } from '../core/ports';
import { DISCLAIMER, SelectionError } from '../core/text-modules';

const INSTRUCTIONS = [
    'Der Zeugnisgenerator setzt deutsche Arbeitszeugnisse (Abschlusszeugnis, Zwischenzeugnis) aus vorformulierten ' +
        'Textbausteinen zusammen, Schritt für Schritt wie die Web-App: Einleitung, Position und Aufgaben, Leistung, ' +
        'Verhalten, Abschluss bzw. Anlass, Dankesformel, Zukunftswünsche. Jedes Zeugnis ist ein Entwurf, den der ' +
        'Server für die angemeldete Person speichert; die Web-App zeigt dieselben Entwürfe.',
    '',
    'Ablauf:',
    '1. Zeugnisart und Anrede (Herr/Frau) klären. Die Anrede wählt die Textvariante. Mit list_drafts lässt sich ' +
        'auch ein vorhandener Entwurf fortsetzen.',
    '2. create_draft: legt den Entwurf an und liefert die Schritte in ihrer Reihenfolge, die Angaben zur Person und ' +
        'den ersten Schritt mit nummerierten Sätzen.',
    '3. Je Schritt mit der Person die Auswahl klären (Regel und Hinweis des Schritts beachten; bei Bewertungsstufen ' +
        'zuerst die Stufe, die zur Beschreibung der Person passt) und mit update_draft speichern, einen Schritt pro ' +
        'Aufruf. Die Antwort enthält den Text bis hierher, offene Schritte und next_step.',
    '4. Den nächsten Schritt mit get_step abrufen und wiederholen, bis complete true ist. Den aktuellen Wortlaut ' +
        'liefert get_draft jederzeit.',
    '5. Erst wenn die Person es ausdrücklich will: finalize_draft. Danach ist der Entwurf schreibgeschützt; ' +
        'export_draft liefert ihn als JSON, import_draft legt daraus einen neuen, bearbeitbaren Entwurf an.',
    '',
    'Entwürfe und finale Fassungen sind {retention_days} Tage nach der letzten Änderung nicht mehr abrufbar und ' +
        'werden danach gelöscht.',
    'Die Bausteine enthalten teils Alternativen ("Mitarbeiter/eine Fachkraft") und Auslassungen (". . ."), die vor ' +
        'der Verwendung angepasst werden müssen. Die Bewertungsstufen entsprechen der üblichen Zeugnissprache; die ' +
        'Wahl gehört zur Verantwortung der Person, die das Zeugnis ausstellt.',
    '',
    `${DISCLAIMER} Das Ergebnis nie als rechtssicher oder geprüft darstellen.`,
].join('\n');

function instructions(retentionDays: number): string {
    return INSTRUCTIONS.replace('{retention_days}', String(retentionDays));
}

const draftId = z.string().describe('Id des Entwurfs aus create_draft oder list_drafts');

export interface McpContext {
    textModules: TextModuleSource;
    drafts?: DraftService;
    // Email of the verified user; undefined without sign-in.
    owner?: string;
}

type ToolResult = {
    content: { type: 'text'; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: true;
};

export function createMcpServer(context: McpContext): McpServer {
    const server = new McpServer(
        { name: 'zeugnisgenerator', version: version },
        { instructions: instructions(context.drafts?.retentionDays ?? 90) },
    );

    // Runs a draft operation for the signed-in user and maps the known errors to tool errors.
    async function withDrafts(action: (drafts: DraftService, owner: string) => Promise<object>): Promise<ToolResult> {
        if (!context.drafts || !context.owner) {
            return error('Entwürfe sind nicht verfügbar: keine Anmeldung oder keine Ablage konfiguriert.');
        }
        try {
            return json({ ...(await action(context.drafts, context.owner)), disclaimer: DISCLAIMER });
        } catch (e) {
            if (e instanceof DraftNotFoundError) {
                return error('Entwurf nicht gefunden. list_drafts zeigt die vorhandenen Entwürfe.');
            }
            if (e instanceof DraftConflictError) {
                return error('Der Entwurf wurde gleichzeitig geändert. Bitte mit get_draft neu laden und wiederholen.');
            }
            if (e instanceof DraftFinalError) {
                return error('Der Entwurf ist final. import_draft mit dem Export legt einen neuen Entwurf an.');
            }
            if (e instanceof UnknownStepError) {
                return error(`Unbekannter Schritt. Erlaubt: ${e.allowed.join(', ')}.`);
            }
            if (e instanceof SelectionError) {
                return error(`Die Auswahl ist ungültig:\n${e.message}`);
            }
            if (e instanceof DraftPatchError) {
                return error('Eine Auswahl braucht den Schritt (step).');
            }
            throw e;
        }
    }

    const read = { readOnlyHint: true, openWorldHint: false };
    const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

    server.registerTool(
        'list_drafts',
        {
            title: 'Entwürfe auflisten',
            description: 'Die Entwürfe der angemeldeten Person, neueste zuerst, mit Status (draft/final).',
            inputSchema: {},
            annotations: read,
        },
        async () =>
            withDrafts(async (drafts, owner) => ({
                drafts: await drafts.list(owner),
                retention_days: drafts.retentionDays,
            })),
    );

    server.registerTool(
        'create_draft',
        {
            title: 'Entwurf anlegen',
            description:
                'Erster Schritt des Ablaufs: legt einen Entwurf an und liefert die Schritte in ihrer Reihenfolge ' +
                '(mit Regel und Hinweis zur Auswahl), die Angaben zur Person, die in den Textbausteinen vorkommen, ' +
                'und den ersten Schritt mit seinen nummerierten Sätzen.',
            inputSchema: { certificate_type: certificateType, form_data: formData.optional() },
            annotations: write,
        },
        async ({ certificate_type, form_data }) =>
            withDrafts(async (drafts, owner) => {
                const reference = { certificate_type, form_data: form_data ?? {}, selections: [] };
                const view = await drafts.create(owner, reference);
                return { ...view, ...start(context.textModules.get(certificate_type, form_data?.salutation)) };
            }),
    );

    server.registerTool(
        'get_step',
        {
            title: 'Schritt abrufen',
            description:
                'Liefert genau einen Schritt (eine Box der Web-App) in der Textvariante des Entwurfs: Unterthemen, ' +
                'Bewertungsstufen, nummerierte Sätze, die Regel für die Auswahl und die bisherige Auswahl des ' +
                'Entwurfs in diesem Schritt (current).',
            inputSchema: { draft_id: draftId, step: step },
            annotations: read,
        },
        async ({ draft_id, step }) => withDrafts((drafts, owner) => drafts.step(owner, draft_id, step)),
    );

    server.registerTool(
        'update_draft',
        {
            title: 'Entwurf ändern',
            description:
                'Speichert Angaben zur Person und/oder die Auswahl eines Schritts (ersetzt die bisherige Auswahl ' +
                'dieses Schritts). Liefert den Text bis hierher, je Schritt die gewählten Sätze im aktuellen ' +
                'Wortlaut, fehlende Angaben, offene Schritte und next_step. Pro Unterthema ist ein Satz möglich. ' +
                DISCLAIMER,
            inputSchema: { draft_id: draftId, ...draftPatch.shape },
            annotations: { ...write, idempotentHint: true },
        },
        async ({ draft_id, ...patch }) => withDrafts((drafts, owner) => drafts.update(owner, draft_id, patch)),
    );

    server.registerTool(
        'get_draft',
        {
            title: 'Entwurf abrufen',
            description:
                'Der aktuelle Stand: vollständiger Text bis hierher, je Schritt die gewählten Sätze im aktuellen ' +
                'Wortlaut, fehlende Angaben, offene Schritte, next_step und Status.',
            inputSchema: { draft_id: draftId },
            annotations: read,
        },
        async ({ draft_id }) => withDrafts((drafts, owner) => drafts.get(owner, draft_id)),
    );

    server.registerTool(
        'finalize_draft',
        {
            title: 'Entwurf abschließen',
            description:
                'Markiert den Entwurf als final; danach lässt er sich nicht mehr ändern. Nur auf ausdrücklichen ' +
                'Wunsch der Person aufrufen.',
            inputSchema: { draft_id: draftId },
            annotations: { ...write, idempotentHint: true },
        },
        async ({ draft_id }) => withDrafts((drafts, owner) => drafts.finalize(owner, draft_id)),
    );

    server.registerTool(
        'export_draft',
        {
            title: 'Entwurf exportieren',
            description: 'Liefert den Entwurf als JSON-Datenobjekt, das import_draft wieder einlesen kann.',
            inputSchema: { draft_id: draftId },
            annotations: read,
        },
        async ({ draft_id }) => withDrafts((drafts, owner) => drafts.export(owner, draft_id)),
    );

    server.registerTool(
        'import_draft',
        {
            title: 'Entwurf importieren',
            description:
                'Legt aus einem Export (export_draft oder Web-App) einen neuen, bearbeitbaren Entwurf der ' +
                'angemeldeten Person an.',
            inputSchema: { data: draftExport.describe('Das exportierte JSON-Datenobjekt') },
            annotations: write,
        },
        async ({ data }) => withDrafts((drafts, owner) => drafts.import(owner, data)),
    );

    server.registerPrompt(
        'zeugnis_erstellen',
        {
            title: 'Arbeitszeugnis erstellen',
            description: 'Startet den geführten Ablauf, Schritt für Schritt wie in der Web-App.',
            argsSchema: {
                certificate_type: certificateType.optional(),
                salutation: salutation.optional(),
            },
        },
        ({ certificate_type, salutation }) => {
            const text = [
                'Erstelle mit mir ein Arbeitszeugnis mit dem Zeugnisgenerator, Schritt für Schritt.',
                certificate_type ? `Zeugnisart: ${certificate_type}.` : 'Frage zuerst nach der Zeugnisart.',
                salutation ? `Anrede: ${salutation}.` : 'Frage nach der Anrede (Herr/Frau).',
                'Lege dann mit create_draft einen Entwurf an, frage die Angaben zur Person ab und gehe die Schritte ' +
                    'einzeln durch: je Schritt die Sätze (bei Bewertungsstufen zuerst die Stufe) mit mir klären, ' +
                    'mit update_draft speichern und mit get_step den nächsten Schritt (next_step) abrufen, bis ' +
                    'complete true ist. Zeige mir zum Schluss den Text aus get_draft.',
                DISCLAIMER,
            ].join('\n');
            return { messages: [{ role: 'user', content: { type: 'text', text: text } }] };
        },
    );

    return server;
}

function json(result: object): ToolResult {
    return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result as Record<string, unknown>,
    };
}

function error(text: string): ToolResult {
    return { content: [{ type: 'text', text: text }], isError: true };
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { version } from '../package.json';
import { PLACEHOLDER_LABELS } from '../src/app/reference-text';
import { DISCLAIMER, SelectionError, catalog, compose, loadTextModules, placeholderCatalog } from './text-modules';

const INSTRUCTIONS = [
    'Der Zeugnisgenerator setzt deutsche Arbeitszeugnisse (Abschlusszeugnis, Zwischenzeugnis) aus vorformulierten ' +
        'Textbausteinen zusammen.',
    '',
    'Ablauf:',
    '1. Zeugnisart, Anrede (Herr/Frau) und die Angaben zur Person klären.',
    '2. list_text_modules mit Zeugnisart und Anrede aufrufen. Die Anrede bestimmt die Textvariante.',
    '3. Je Thema bzw. Unterthema einen Satz wählen; bei bewerteten Unterthemen zuerst die Bewertungsstufe ' +
        '(z. B. "sehr gut"), die zur Beschreibung der Person passt.',
    '4. compose_reference mit denselben Angaben aufrufen und das Ergebnis mit den fehlenden Angaben zeigen.',
    '',
    'Die Bausteine enthalten teils Alternativen ("Mitarbeiter/eine Fachkraft") und Auslassungen (". . ."), die vor ' +
        'der Verwendung angepasst werden müssen. Die Bewertungsstufen entsprechen der üblichen Zeugnissprache; die ' +
        'Wahl gehört zur Verantwortung der Person, die das Zeugnis ausstellt.',
    '',
    `${DISCLAIMER} Das Ergebnis nie als rechtssicher oder geprüft darstellen.`,
].join('\n');

const certificateType = z
    .enum(['abschlusszeugnis', 'zwischenzeugnis'])
    .describe('Zeugnisart: Abschlusszeugnis (Ende des Arbeitsverhältnisses) oder Zwischenzeugnis');

const salutation = z.enum(['Herr', 'Frau']).describe('Anrede; "Frau" wählt die weibliche Textvariante');

const formDataShape = Object.fromEntries(
    Object.entries(PLACEHOLDER_LABELS)
        .filter(([name]) => name !== 'salutation')
        .map(([name, label]) => [name, z.string().optional().describe(label)]),
);

const formData = z
    .object({ salutation: salutation.optional(), ...formDataShape })
    .describe('Angaben zur Person, die die Platzhalter ersetzen. Datumsangaben im Format TT.MM.JJJJ.');

const selection = z.object({
    topic: z.string().describe('Thema aus list_text_modules, z. B. "performance"'),
    subtopic: z.string().optional().describe('Unterthema, wenn das Thema Unterthemen hat'),
    rating: z.string().optional().describe('Bewertungsstufe, wenn das (Unter-)Thema Bewertungsstufen hat'),
    sentence: z.number().int().min(0).describe('Nummer des Satzes aus list_text_modules'),
});

export function createMcpServer(): McpServer {
    const server = new McpServer({ name: 'zeugnisgenerator', version: version }, { instructions: INSTRUCTIONS });

    server.registerTool(
        'list_text_modules',
        {
            title: 'Textbausteine auflisten',
            description:
                'Liefert die Textbausteine einer Zeugnisart mit nummerierten Sätzen, gegliedert nach Thema, ' +
                'Unterthema und Bewertungsstufe, sowie die Platzhalter. Die Anrede bestimmt die Textvariante und ' +
                'muss zu compose_reference passen. Mit topic lässt sich die Liste auf ein Thema beschränken.',
            inputSchema: {
                certificate_type: certificateType,
                salutation: salutation.optional(),
                topic: z.string().optional().describe('Nur dieses Thema liefern, z. B. "performance"'),
            },
            annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async ({ certificate_type, salutation, topic }) => {
            const textModules = loadTextModules(certificate_type, salutation);
            const topics = catalog(textModules, topic);
            if (topics.length === 0) {
                const allowed = catalog(textModules)
                    .map((t) => t.topic)
                    .join(', ');
                return error(`Unbekanntes Thema "${topic}". Erlaubt: ${allowed}.`);
            }
            const result = { placeholders: placeholderCatalog(), topics: topics, disclaimer: DISCLAIMER };
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        },
    );

    server.registerTool(
        'compose_reference',
        {
            title: 'Zeugnis zusammensetzen',
            description:
                'Setzt aus den gewählten Sätzen und den Angaben zur Person den Zeugnistext zusammen, in der ' +
                'Reihenfolge der Textbausteine. Pro Thema bzw. Unterthema ist ein Satz möglich. Fehlende Angaben ' +
                'erscheinen im Text als [Bezeichnung] und werden zusätzlich aufgelistet. ' +
                DISCLAIMER,
            inputSchema: {
                certificate_type: certificateType,
                form_data: formData,
                selections: z.array(selection).min(1).describe('Gewählte Sätze'),
            },
            outputSchema: {
                text: z.string(),
                missing_placeholders: z.array(z.object({ name: z.string(), label: z.string() })),
                disclaimer: z.string(),
            },
            annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async ({ certificate_type, form_data, selections }) => {
            const textModules = loadTextModules(certificate_type, form_data.salutation);
            try {
                const composition = compose(textModules, selections, form_data);
                const result = {
                    text: composition.text,
                    missing_placeholders: composition.missingPlaceholders,
                    disclaimer: DISCLAIMER,
                };
                return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
            } catch (e) {
                if (e instanceof SelectionError) {
                    return error(`Die Auswahl ist ungültig:\n${e.message}`);
                }
                throw e;
            }
        },
    );

    return server;
}

function error(text: string): { content: { type: 'text'; text: string }[]; isError: true } {
    return { content: [{ type: 'text', text: text }], isError: true };
}

// REST API under /api, used by the web app and by agents and scripts that do
// not speak MCP. The guided workflow mirrors the MCP tools (mcp/) one to one;
// both are thin layers over the core (core/steps.ts, core/text-modules.ts).
import { Request, Response, Router } from 'express';
import * as z from 'zod/v4';
import { CertificateType } from '../../src/app/reference-text';
import { TextModuleSource } from '../core/ports';
import { apiError, parse } from './errors';
import { openApiDocument } from './openapi';
import { CERTIFICATE_TYPES, certificateType, referenceDraft, salutation } from '../core/schemas';
import { draft, start, stepBox, stepIds } from '../core/steps';
import { DISCLAIMER, SelectionError } from '../core/text-modules';

const variantQuery = z.object({ salutation: salutation.optional() });

export function createApiRouter({ textModules: source }: { textModules: TextModuleSource }): Router {
    const router = Router();

    router.get('/openapi.json', (_req, res) => {
        res.json(openApiDocument());
    });

    router.get('/certificate-types', (_req, res) => {
        res.json({ certificate_types: CERTIFICATE_TYPES, salutations: salutation.options, disclaimer: DISCLAIMER });
    });

    // The steps in order, the person fields and the first step, without a stored draft.
    router.get('/certificate-types/:type/steps', (req, res) => {
        const variant = parseVariant(req, res);
        if (!variant) {
            return;
        }
        const textModules = source.get(variant.type, variant.salutation);
        revalidate(res).json({ ...variantInfo(variant), ...start(textModules), disclaimer: DISCLAIMER });
    });

    // MCP get_step: one step (one box of the web app).
    router.get('/certificate-types/:type/steps/:step', (req, res) => {
        const variant = parseVariant(req, res);
        if (!variant) {
            return;
        }
        const textModules = source.get(variant.type, variant.salutation);
        const box = stepBox(textModules, String(req.params['step']));
        if (!box) {
            const allowed = stepIds(textModules);
            res.status(404).json(apiError('unknown_step', 'Unbekannter Schritt.', { allowed }));
            return;
        }
        revalidate(res).json({ ...variantInfo(variant), ...box, disclaimer: DISCLAIMER });
    });

    // The text modules in the structure of the JSON files, as the web app renders them.
    router.get('/certificate-types/:type/text-modules', (req, res) => {
        const variant = parseVariant(req, res);
        if (!variant) {
            return;
        }
        const textModules = source.get(variant.type, variant.salutation);
        revalidate(res).json({ ...variantInfo(variant), textblocks: textModules.textblocks, disclaimer: DISCLAIMER });
    });

    // Text so far and progress, for partial selections too. Nothing is stored (stored drafts: drafts-api.ts).
    router.post('/references', (req, res) => {
        // The request and the result contain personal data: never cache, never log.
        res.set('Cache-Control', 'no-store');
        const body = parse(referenceDraft, req.body, res);
        if (!body) {
            return;
        }
        const textModules = source.get(body.certificate_type, body.form_data.salutation);
        try {
            res.json({ ...draft(textModules, body.selections, body.form_data), disclaimer: DISCLAIMER });
        } catch (e) {
            if (e instanceof SelectionError) {
                res.status(422).json(apiError('invalid_selection', 'Die Auswahl ist ungültig.', e.problems));
                return;
            }
            throw e;
        }
    });

    router.use((_req, res) => {
        res.status(404).json(apiError('not_found', 'Unbekannter Endpunkt. Siehe /api/openapi.json.'));
    });

    return router;
}

interface Variant {
    type: CertificateType;
    salutation?: 'Herr' | 'Frau';
}

function variantInfo(variant: Variant): { certificate_type: CertificateType; salutation: 'Herr' | 'Frau' } {
    return { certificate_type: variant.type, salutation: variant.salutation ?? 'Herr' };
}

// Certificate type from the path and salutation from the query; answers 404 or 400 otherwise.
function parseVariant(req: Request, res: Response): Variant | undefined {
    const type = certificateType.safeParse(req.params['type']);
    if (!type.success) {
        const allowed = certificateType.options;
        res.status(404).json(apiError('unknown_certificate_type', 'Unbekannte Zeugnisart.', { allowed }));
        return undefined;
    }
    const query = parse(variantQuery, req.query, res);
    return query && { type: type.data, salutation: query.salutation };
}

// The text modules only change with a deploy: let clients revalidate via ETag.
function revalidate(res: Response): Response {
    return res.set('Cache-Control', 'private, no-cache');
}

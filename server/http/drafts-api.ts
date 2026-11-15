// REST endpoints of the stored drafts under /api/drafts, a thin layer over
// DraftService (core/drafts.ts). Mirrors the draft tools of the MCP server.
import { Request, Response, Router } from 'express';
import {
    DraftConflictError,
    DraftFinalError,
    DraftNotFoundError,
    DraftPatchError,
    DraftService,
    UnknownStepError,
} from '../core/drafts';
import { apiError, parse } from './errors';
import { Identity } from '../core/ports';
import { draftExport, draftPatch, newDraft, referenceDraft } from '../core/schemas';
import { DISCLAIMER, SelectionError } from '../core/text-modules';

export interface DraftsApiOptions {
    service: DraftService;
    // The verified identity of the request (IAP, or the development user).
    identity: (res: Response) => Identity | undefined;
}

export function createDraftsRouter(options: DraftsApiOptions): Router {
    const { service, identity } = options;
    const router = Router();

    router.use((_req, res, next) => {
        // Drafts contain personal data: never cache.
        res.set('Cache-Control', 'no-store');
        if (!identity(res)) {
            res.status(401).json(apiError('unauthenticated', 'Anmeldung fehlt.'));
            return;
        }
        next();
    });

    const owner = (res: Response): string => (identity(res) as Identity).email;

    router.get('/', async (_req, res) => {
        const drafts = await service.list(owner(res));
        res.json({ drafts: drafts, retention_days: service.retentionDays, disclaimer: DISCLAIMER });
    });

    router.post('/', (req, res) =>
        handle(res, async () => {
            const body = parse(newDraft, req.body, res);
            return body && res.status(201).json(await service.create(owner(res), body));
        }),
    );

    router.post('/import', (req, res) =>
        handle(res, async () => {
            const body = parse(draftExport, req.body, res);
            return body && res.status(201).json(await service.import(owner(res), body));
        }),
    );

    router.get('/:id', (req, res) => handle(res, async () => res.json(await service.get(owner(res), id(req)))));

    router.put('/:id', (req, res) =>
        handle(res, async () => {
            const body = parse(referenceDraft, req.body, res);
            return body && res.json(await service.replace(owner(res), id(req), body));
        }),
    );

    router.patch('/:id', (req, res) =>
        handle(res, async () => {
            const body = parse(draftPatch, req.body, res);
            return body && res.json(await service.update(owner(res), id(req), body));
        }),
    );

    router.delete('/:id', (req, res) =>
        handle(res, async () => {
            await service.delete(owner(res), id(req));
            res.status(204).end();
        }),
    );

    router.post('/:id/finalize', (req, res) =>
        handle(res, async () => res.json(await service.finalize(owner(res), id(req)))),
    );

    // Plaintext JSON on purpose: the user downloads it and can import it again.
    router.get('/:id/export', (req, res) =>
        handle(res, async () => {
            const data = await service.export(owner(res), id(req));
            res.set('Content-Disposition', 'attachment; filename="zeugnis-entwurf.json"').json(data);
        }),
    );

    router.get('/:id/steps/:step', (req, res) =>
        handle(res, async () => {
            const view = await service.step(owner(res), id(req), String(req.params['step']));
            res.json({ ...view, disclaimer: DISCLAIMER });
        }),
    );

    return router;
}

function id(req: Request): string {
    return String(req.params['id']);
}

async function handle(res: Response, action: () => Promise<unknown>): Promise<void> {
    try {
        await action();
    } catch (e) {
        if (e instanceof DraftNotFoundError) {
            res.status(404).json(apiError('draft_not_found', 'Entwurf nicht gefunden.'));
        } else if (e instanceof DraftConflictError) {
            res.status(409).json(
                apiError('draft_conflict', 'Der Entwurf wurde gleichzeitig geändert. Bitte laden Sie ihn neu.'),
            );
        } else if (e instanceof DraftFinalError) {
            res.status(409).json(apiError('draft_final', 'Der Entwurf ist final und lässt sich nicht mehr ändern.'));
        } else if (e instanceof SelectionError) {
            res.status(422).json(apiError('invalid_selection', 'Die Auswahl ist ungültig.', e.problems));
        } else if (e instanceof UnknownStepError) {
            res.status(404).json(apiError('unknown_step', 'Unbekannter Schritt.', { allowed: e.allowed }));
        } else if (e instanceof DraftPatchError) {
            res.status(400).json(apiError('invalid_request', 'Eine Auswahl braucht den Schritt (step).'));
        } else {
            throw e;
        }
    }
}

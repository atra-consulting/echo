import express, { ErrorRequestHandler, Express, Request, RequestHandler, Response } from 'express';
import {
    hostHeaderValidation,
    localhostHostValidation,
} from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';
import { version } from '../../package.json';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Identity, IdentityProvider, TextModuleSource } from '../core/ports';
import { DraftService } from '../core/drafts';
import { McpContext, createMcpServer } from '../mcp/mcp-server';
import { createApiRouter } from './api';
import { createDraftsRouter } from './drafts-api';
import { apiError } from './errors';
import { GOOGLE_CALLBACK_PATH, GoogleAuthConfig, GoogleOAuthProvider } from './google-oauth';

// Driving adapter for HTTP: REST API under /api, MCP under /mcp. Both call the
// same use cases of the core; this layer only translates.

// off: no /mcp at all. none: /mcp without authentication of its own (local, or
// behind IAP). google: /mcp with the OAuth proxy to Google (google-oauth.ts).
export type McpAuth = 'off' | 'none' | 'google';

export const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'];

export interface AppOptions {
    host: string;
    publicUrl: URL;
    textModules: TextModuleSource;
    mcpAuth: McpAuth;
    // Required with mcpAuth 'google'.
    google?: Omit<GoogleAuthConfig, 'publicUrl'>;
    // Who is calling (IAP assertion, or a development user).
    identity?: IdentityProvider;
    // With IAP: /api (except /api/health) and an /mcp without authentication of
    // its own answer 401 without a verified identity.
    requireIdentity?: boolean;
    // Number of proxies in front of the server whose X-Forwarded-For is trusted.
    trustProxy?: number;
    // Stored drafts per user; without it /api/drafts answers 404 and the MCP tools report that drafts are off.
    drafts?: DraftService;
}

export function createApp(options: AppOptions): Express {
    const { host, publicUrl, mcpAuth, google, drafts, textModules } = options;
    const app = express();

    // Before the Host check: startup probes and health checks may send any Host
    // (e.g. the instance IP). The answer reveals nothing but the version.
    app.get('/api/health', (_req, res) => {
        res.set('Cache-Control', 'no-store').json({ status: 'ok', version: version });
    });

    // Protection against DNS rebinding: only these Host headers are accepted
    // (as createMcpExpressApp of the MCP SDK does it). The reverse proxy in
    // front (nginx) sends its upstream, i.e. a loopback address.
    const loopback = LOOPBACK_HOSTS.includes(host);
    const allowedHosts = [publicUrl.hostname, 'localhost', '127.0.0.1', '[::1]'];
    app.use(loopback ? localhostHostValidation() : hostHeaderValidation(allowedHosts));
    app.use(express.json());
    // Behind the proxies of Cloud Run and nginx; needed for the client IP in the rate limits.
    app.set('trust proxy', options.trustProxy ?? 1);

    const identify = identifyRequest(options.identity, options.requireIdentity ?? false);

    app.use('/api', identify);
    if (drafts) {
        app.use('/api/drafts', createDraftsRouter({ service: drafts, identity: currentIdentity }));
    } else {
        app.use('/api/drafts', (_req, res) => {
            res.status(404).json(apiError('drafts_disabled', 'Entwürfe sind nicht aktiviert.'));
        });
    }
    app.use('/api', createApiRouter({ textModules }));

    if (mcpAuth !== 'off') {
        const requireAuth = mcpAuth === 'google' ? googleAuth(app, publicUrl, google) : identify;
        addMcp(app, requireAuth, (req, res) => ({
            drafts: drafts,
            textModules: textModules,
            // With MCP_AUTH=google the user is the one of the bearer token.
            owner: mcpAuth === 'google' ? tokenEmail(req) : currentIdentity(res)?.email,
        }));
    }

    app.use(handleErrors);
    return app;
}

// Stores the identity of the request for the handlers; answers 401 if one is required and missing.
function identifyRequest(provider: IdentityProvider | undefined, required: boolean): RequestHandler {
    return (req, res, next) => {
        if (!provider) {
            next();
            return;
        }
        provider.identify(req.headers).then((identity) => {
            if (identity) {
                res.locals['identity'] = identity;
            } else if (required) {
                res.status(401).json(apiError('unauthenticated', 'Anmeldung fehlt oder ist ungültig.'));
                return;
            }
            next();
        }, next);
    };
}

function currentIdentity(res: Response): Identity | undefined {
    return res.locals['identity'] as Identity | undefined;
}

function googleAuth(app: Express, publicUrl: URL, google: AppOptions['google']): RequestHandler {
    if (!google) {
        throw new Error('MCP_AUTH=google needs the Google configuration');
    }
    const provider = new GoogleOAuthProvider({ ...google, publicUrl });
    app.use(
        mcpAuthRouter({
            provider: provider,
            issuerUrl: publicUrl,
            resourceServerUrl: provider.resourceUrl,
            resourceName: 'Zeugnisgenerator',
            // claude.ai calls from few addresses on behalf of all users; the defaults are too tight.
            clientRegistrationOptions: { clientIdGeneration: false, rateLimit: { max: 200 } },
            tokenOptions: { rateLimit: { max: 500 } },
        }),
    );
    app.get(GOOGLE_CALLBACK_PATH, (req, res, next) => provider.handleGoogleCallback(req, res).catch(next));

    return requireBearerAuth({
        verifier: provider,
        expectedResource: provider.resourceUrl,
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(provider.resourceUrl),
    });
}

function tokenEmail(req: Request): string | undefined {
    const email = req.auth?.extra?.['email'];
    return typeof email === 'string' ? email : undefined;
}

function addMcp(app: Express, requireAuth: RequestHandler, context: (req: Request, res: Response) => McpContext): void {
    // Stateless: a new server and transport per request, no sessions.
    app.post('/mcp', requireAuth, async (req: Request, res: Response) => {
        const server = createMcpServer(context(req, res));
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        res.on('close', () => {
            void transport.close();
            void server.close();
        });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            // Never log the request, it contains personal data.
            console.error('MCP request failed:', error instanceof Error ? error.message : error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error' },
                    id: null,
                });
            }
        }
    });

    app.all('/mcp', (_req, res) => {
        res.status(405)
            .set('Allow', 'POST')
            .json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Method not allowed' },
                id: null,
            });
    });
}

// Replaces the default handler of Express, which logs the whole error: the
// message of a JSON syntax error quotes the request body, i.e. personal data.
const handleErrors: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }
    const status = typeof error?.status === 'number' && error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) {
        console.error('Request failed:', error instanceof Error ? error.message : 'unknown error');
        res.status(500).json(apiError('internal', 'Interner Fehler.'));
        return;
    }
    res.status(status).json(apiError('bad_request', 'Die Anfrage ist ungültig (z. B. kein gültiges JSON).'));
};

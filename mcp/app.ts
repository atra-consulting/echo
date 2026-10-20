import { Express, Request, RequestHandler, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { GOOGLE_CALLBACK_PATH, GoogleAuthConfig, GoogleOAuthProvider } from './auth';
import { createMcpServer } from './server';

export interface AppOptions {
    host: string;
    publicUrl: URL;
    // Without it the server runs without authentication.
    google?: Omit<GoogleAuthConfig, 'publicUrl'>;
}

export function createApp(options: AppOptions): Express {
    const { host, publicUrl, google } = options;
    const app = createMcpExpressApp(google ? { host, allowedHosts: [publicUrl.hostname] } : { host });
    // Behind the proxy of Cloud Run; needed for the client IP in the rate limits.
    app.set('trust proxy', 1);

    let requireAuth: RequestHandler = (_req, _res, next) => next();

    if (google) {
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

        requireAuth = requireBearerAuth({
            verifier: provider,
            expectedResource: provider.resourceUrl,
            resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(provider.resourceUrl),
        });
    }

    // Stateless: a new server and transport per request, no sessions.
    app.post('/mcp', requireAuth, async (req: Request, res: Response) => {
        const server = createMcpServer();
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

    return app;
}

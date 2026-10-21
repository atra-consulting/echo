// Composition root of the backend: reads the configuration from the
// environment (the only place that does) and wires the adapters to the core.
// REST API under /api, MCP server under /mcp (Streamable HTTP, stateless).
// The variables are described in the README section "Backend".
import { Keyring, KeyringError } from './adapters/aes-gcm-cipher';
import { bundledTextModules } from './adapters/bundled-text-modules';
import { FileTextModuleSource } from './adapters/file-text-modules';
import { FixedIdentityProvider, IapIdentityProvider } from './adapters/iap-identity';
import { MemoryDraftStore } from './adapters/memory-draft-store';
import { DraftService } from './core/drafts';
import { DraftStore, IdentityProvider, TextModuleSource } from './core/ports';
import { LOOPBACK_HOSTS, McpAuth, createApp } from './http/app';

const MCP_AUTH_MODES: McpAuth[] = ['off', 'none', 'google'];
const DRAFT_STORES = ['off', 'memory', 'firestore'];

const env = process.env;

// API_PORT first: on Cloud Run the backend runs as a sidecar next to the
// ingress container, and PORT belongs to the ingress.
const port = Number(env['API_PORT'] || env['PORT'] || 8081);
const mcpAuth = (env['MCP_AUTH'] || 'off') as McpAuth;
const iapAudience = env['IAP_AUDIENCE'] || undefined;
const draftStore = env['DRAFT_STORE'] || 'off';
const retentionDays = Number(env['RETENTION_DAYS'] || 90);
const devUserEmail = env['DEV_USER_EMAIL'] || undefined;
const onCloudRun = !!env['K_SERVICE'];

if (!MCP_AUTH_MODES.includes(mcpAuth)) {
    fail(`MCP_AUTH must be one of ${MCP_AUTH_MODES.join(', ')}, not "${mcpAuth}"`);
}
if (!DRAFT_STORES.includes(draftStore)) {
    fail(`DRAFT_STORE must be one of ${DRAFT_STORES.join(', ')}, not "${draftStore}"`);
}
if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    fail('RETENTION_DAYS must be a positive whole number');
}
// The development user stands in for IAP on this machine only, never next to IAP or on Cloud Run.
if (devUserEmail && (iapAudience || onCloudRun)) {
    fail('DEV_USER_EMAIL is only allowed locally without IAP_AUDIENCE');
}
if (draftStore !== 'off' && !iapAudience && !devUserEmail) {
    fail(`DRAFT_STORE=${draftStore} needs a verified user: set IAP_AUDIENCE (or DEV_USER_EMAIL locally)`);
}
if (mcpAuth !== 'off' && draftStore === 'off') {
    console.warn('MCP without DRAFT_STORE: the draft tools answer that drafts are not available.');
}

// Only loopback by default: the reverse proxy in front (nginx) is the only way
// in, so neither /api nor /mcp can be exposed by accident, e.g. in a container.
const host = env['HOST'] || '127.0.0.1';
const loopback = LOOPBACK_HOSTS.includes(host);
const publicUrl = new URL(env['PUBLIC_URL'] || `http://localhost:${port}`);

// Without IAP only the local development setup may listen beyond loopback (DEV_USER_EMAIL is refused on Cloud Run).
if (!loopback && mcpAuth === 'none' && !iapAudience && !devUserEmail) {
    fail('MCP_AUTH=none on a non-loopback HOST needs IAP_AUDIENCE, otherwise /mcp is open to anyone');
}
if (!loopback && !iapAudience) {
    console.warn(`HOST=${host} without IAP_AUDIENCE: /api is reachable without authentication.`);
}
if (onCloudRun && !iapAudience) {
    console.warn('Running on Cloud Run without IAP_AUDIENCE: the IAP assertion is not checked.');
}
if (mcpAuth === 'none') {
    console.warn(`MCP_AUTH=none: /mcp has no authentication of its own${iapAudience ? ' (IAP is checked)' : ''}.`);
}

void wire().then(({ textModules, identity, drafts }) => {
    const app = createApp({
        host: host,
        publicUrl: publicUrl,
        textModules: textModules,
        mcpAuth: mcpAuth,
        google:
            mcpAuth === 'google'
                ? {
                      googleClientId: required('GOOGLE_CLIENT_ID'),
                      googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
                      allowedDomain: required('GOOGLE_ALLOWED_DOMAIN'),
                      tokenKey: tokenKey(required('TOKEN_SECRET')),
                  }
                : undefined,
        identity: identity,
        requireIdentity: !!iapAudience,
        trustProxy: Number(env['TRUST_PROXY'] || 1),
        drafts: drafts,
    });

    app.listen(port, host, () => {
        const mcp = mcpAuth === 'off' ? 'off' : `${publicUrl.origin}/mcp (auth: ${mcpAuth})`;
        console.log(
            `Zeugnisgenerator backend listening on ${host}:${port}; API ${publicUrl.origin}/api, MCP ${mcp}, ` +
                `IAP check ${iapAudience ? 'on' : 'off'}, drafts ${draftStore}`,
        );
    });
});

async function wire(): Promise<{
    textModules: TextModuleSource;
    identity?: IdentityProvider;
    drafts?: DraftService;
}> {
    // Forks can point TEXT_MODULES_DIR to their own text modules instead of the bundled ones.
    const directory = env['TEXT_MODULES_DIR'];
    let textModules: TextModuleSource = bundledTextModules;
    if (directory) {
        try {
            textModules = new FileTextModuleSource(directory);
        } catch (e) {
            fail(`TEXT_MODULES_DIR: ${e instanceof Error ? e.message : 'unreadable'}`);
        }
    }

    let identity: IdentityProvider | undefined;
    if (iapAudience) {
        identity = new IapIdentityProvider(iapAudience);
    } else if (devUserEmail) {
        identity = new FixedIdentityProvider({ email: devUserEmail, subject: `dev:${devUserEmail}` });
    }

    if (draftStore === 'off') {
        return { textModules, identity };
    }
    const cipher = keyring();
    let store: DraftStore;
    if (draftStore === 'firestore') {
        // Loaded only when used; the image ships the package next to the bundle.
        const { FirestoreDraftStore } = await import('./adapters/firestore-draft-store');
        store = new FirestoreDraftStore();
    } else {
        console.warn('DRAFT_STORE=memory: drafts live only as long as this process.');
        store = new MemoryDraftStore();
    }
    return { textModules, identity, drafts: new DraftService(store, cipher, textModules, { retentionDays }) };
}

// Fail closed: Firestore only with a valid key ring. The memory store may use a key of its own.
function keyring(): Keyring {
    const json = env['DRAFT_ENCRYPTION_KEY'];
    if (!json && draftStore === 'memory') {
        return Keyring.ephemeral();
    }
    try {
        return Keyring.parse(json);
    } catch (e) {
        fail(`DRAFT_ENCRYPTION_KEY: ${e instanceof KeyringError ? e.message : 'invalid'}`);
    }
}

function required(name: string): string {
    const value = env[name];
    if (!value) {
        fail(`${name} is required with MCP_AUTH=google`);
    }
    return value;
}

function tokenKey(secret: string): Uint8Array {
    const key = Buffer.from(secret, 'base64');
    if (key.length !== 32) {
        fail('TOKEN_SECRET must be 32 bytes in base64, e.g. from "openssl rand -base64 32"');
    }
    return new Uint8Array(key);
}

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

// Entry point of the MCP server (Streamable HTTP, stateless). Configuration
// via environment variables, see the README section "MCP-Server".
import { createApp } from './app';

const port = Number(process.env['PORT'] || 8080);
const authMode = process.env['MCP_AUTH'] || 'google';

if (authMode !== 'google' && authMode !== 'none') {
    fail(`MCP_AUTH must be "google" or "none", not "${authMode}"`);
}

// Without authentication the server only listens on localhost, so it cannot be
// exposed by accident, e.g. in a container.
const host = authMode === 'none' ? '127.0.0.1' : '0.0.0.0';
const publicUrl = new URL(process.env['PUBLIC_URL'] || `http://localhost:${port}`);

if (authMode === 'none') {
    console.warn('MCP_AUTH=none: the server runs without authentication and only listens on 127.0.0.1.');
}

const app = createApp({
    host: host,
    publicUrl: publicUrl,
    google:
        authMode === 'google'
            ? {
                  googleClientId: required('GOOGLE_CLIENT_ID'),
                  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
                  allowedDomain: required('GOOGLE_ALLOWED_DOMAIN'),
                  tokenKey: tokenKey(required('TOKEN_SECRET')),
              }
            : undefined,
});

app.listen(port, host, () => {
    console.log(`Zeugnisgenerator MCP server listening on ${publicUrl.origin}/mcp (auth: ${authMode})`);
});

function required(name: string): string {
    const value = process.env[name];
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

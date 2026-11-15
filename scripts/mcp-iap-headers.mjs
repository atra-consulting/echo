#!/usr/bin/env node
// headersHelper for MCP clients such as Claude Code: prints the header that
// lets a request pass Identity-Aware Proxy (IAP) with the user's own identity:
//   {"Proxy-Authorization": "Bearer <ID token>"}
// IAP checks and removes Proxy-Authorization; the backend then gets the
// signed IAP assertion and uses its email as the owner of the drafts.
//
// Configuration (environment):
//   IAP_OAUTH_CLIENT_ID   OAuth client the ID token is issued for. Whoever runs
//                         the Google Cloud project must allowlist it for IAP
//                         programmatic access.
//   IAP_CREDENTIALS_FILE  authorized-user credentials of that client with a
//                         refresh token (default: gcloud's application default
//                         credentials file).
//
// One-time setup, with the client's JSON file (type "Desktop app"):
//   gcloud auth application-default login --client-id-file=client.json \
//     --scopes=openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform
//
// ID tokens are valid for one hour; the client runs this script when it connects.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const clientId = process.env.IAP_OAUTH_CLIENT_ID;
const credentialsFile =
    process.env.IAP_CREDENTIALS_FILE ||
    (process.platform === 'win32'
        ? join(process.env.APPDATA ?? '', 'gcloud', 'application_default_credentials.json')
        : join(homedir(), '.config', 'gcloud', 'application_default_credentials.json'));

function fail(message) {
    // Never print tokens or secrets, only what to do.
    console.error(`mcp-iap-headers: ${message}`);
    process.exit(1);
}

if (!clientId) {
    fail('IAP_OAUTH_CLIENT_ID is not set');
}

let credentials;
try {
    credentials = JSON.parse(readFileSync(credentialsFile, 'utf8'));
} catch {
    fail(`cannot read ${credentialsFile}; see the setup at the top of this script`);
}
if (credentials.type !== 'authorized_user' || !credentials.refresh_token) {
    fail(`${credentialsFile} holds no user credentials with a refresh token`);
}
if (credentials.client_id !== clientId) {
    fail(`${credentialsFile} belongs to another OAuth client; log in with the client of IAP_OAUTH_CLIENT_ID`);
}

const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: credentials.client_id,
        client_secret: credentials.client_secret ?? '',
        refresh_token: credentials.refresh_token,
    }),
}).catch(() => fail('Google token endpoint not reachable'));

if (!response.ok) {
    fail(`token request failed with status ${response.status}; log in again (see the setup)`);
}
const { id_token: idToken } = await response.json();
if (!idToken) {
    fail('no ID token received; the login needs the scope "openid"');
}

process.stdout.write(JSON.stringify({ 'Proxy-Authorization': `Bearer ${idToken}` }));

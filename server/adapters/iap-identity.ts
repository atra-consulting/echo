// IdentityProviders: the signed header of Identity-Aware Proxy (IAP), and a
// fixed user for local development without IAP.
//
// IAP adds a signed assertion to every request it lets through. The plain
// identity headers (x-goog-authenticated-user-*) could be set by anyone who
// reaches the container another way; the signed assertion cannot.
import { JWTPayload, JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from 'jose';
import { Identity, IdentityProvider } from '../core/ports';

export const IAP_HEADER = 'x-goog-iap-jwt-assertion';
const IAP_ISSUER = 'https://cloud.google.com/iap';
const IAP_KEYS_URL = new URL('https://www.gstatic.com/iap/verify/public_key-jwk');

export class IapIdentityProvider implements IdentityProvider {
    private readonly keys: JWTVerifyGetKey;

    // audience for IAP directly on Cloud Run: /projects/<number>/locations/<region>/services/<service>.
    // keys: Google's IAP keys; replaced in tests.
    constructor(
        private readonly audience: string,
        keys?: JWTVerifyGetKey,
    ) {
        this.keys = keys ?? createRemoteJWKSet(IAP_KEYS_URL);
    }

    public async identify(headers: Record<string, string | string[] | undefined>): Promise<Identity | undefined> {
        const assertion = headers[IAP_HEADER];
        if (typeof assertion !== 'string' || !assertion) {
            return undefined;
        }
        try {
            const { payload } = await jwtVerify(assertion, this.keys, {
                issuer: IAP_ISSUER,
                audience: this.audience,
                algorithms: ['ES256'],
                // IAP assertions always carry both; without exp an assertion would never expire.
                requiredClaims: ['exp', 'iat'],
            });
            return identityFromIapClaims(payload);
        } catch {
            return undefined;
        }
    }
}

// IAP prefixes both claims with "accounts.google.com:".
const PREFIX = /^accounts\.google\.com:/;

export function identityFromIapClaims(claims: JWTPayload): Identity | undefined {
    const email = typeof claims['email'] === 'string' ? claims['email'].replace(PREFIX, '') : '';
    const subject = typeof claims.sub === 'string' ? claims.sub.replace(PREFIX, '') : '';
    return email && subject ? { email, subject } : undefined;
}

// The same user for every request: only for local development without IAP
// (main.ts refuses it next to IAP and on Cloud Run).
export class FixedIdentityProvider implements IdentityProvider {
    constructor(private readonly identity: Identity) {}

    public async identify(): Promise<Identity> {
        return this.identity;
    }
}

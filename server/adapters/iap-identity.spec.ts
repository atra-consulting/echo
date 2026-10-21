// The IAP identity provider with assertions signed by a test key instead of Google's.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { CryptoKey, SignJWT, generateKeyPair } from 'jose';
import { FixedIdentityProvider, IAP_HEADER, IapIdentityProvider, identityFromIapClaims } from './iap-identity';

const AUDIENCE = '/projects/123/locations/europe-west1/services/zeugnisgenerator';

describe('IAP identity', () => {
    let privateKey: CryptoKey;
    let provider: IapIdentityProvider;

    before(async () => {
        const keys = await generateKeyPair('ES256');
        privateKey = keys.privateKey;
        provider = new IapIdentityProvider(AUDIENCE, async () => keys.publicKey);
    });

    function assertion(audience = AUDIENCE, issuer = 'https://cloud.google.com/iap', email = true): Promise<string> {
        return new SignJWT(email ? { email: 'accounts.google.com:someone@example.com' } : {})
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuer(issuer)
            .setAudience(audience)
            .setSubject('accounts.google.com:1234')
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
    }

    it('takes the identity from a valid assertion, without the prefix of IAP', async () => {
        assert.deepEqual(await provider.identify({ [IAP_HEADER]: await assertion() }), {
            email: 'someone@example.com',
            subject: '1234',
        });
    });

    it('accepts no missing, invalid or foreign assertion and ignores unsigned headers', async () => {
        const unsigned = { 'x-goog-authenticated-user-email': 'accounts.google.com:someone@example.com' };
        assert.equal(await provider.identify(unsigned), undefined);
        assert.equal(await provider.identify({ [IAP_HEADER]: 'not-a-jwt' }), undefined);
        assert.equal(await provider.identify({ [IAP_HEADER]: await assertion('/projects/9/other') }), undefined);
        assert.equal(await provider.identify({ [IAP_HEADER]: await assertion(AUDIENCE, 'https://evil') }), undefined);
        assert.equal(await provider.identify({ [IAP_HEADER]: await assertion(AUDIENCE, undefined, false) }), undefined);
    });

    it('accepts no expired assertion and none without exp or iat', async () => {
        const base = () =>
            new SignJWT({ email: 'accounts.google.com:someone@example.com' })
                .setProtectedHeader({ alg: 'ES256' })
                .setIssuer('https://cloud.google.com/iap')
                .setAudience(AUDIENCE)
                .setSubject('accounts.google.com:1234');
        const expired = await base().setIssuedAt(1_000).setExpirationTime(2_000).sign(privateKey);
        const withoutExp = await base().setIssuedAt().sign(privateKey);
        const withoutIat = await base().setExpirationTime('5m').sign(privateKey);
        for (const token of [expired, withoutExp, withoutIat]) {
            assert.equal(await provider.identify({ [IAP_HEADER]: token }), undefined);
        }
    });

    it('needs email and subject', () => {
        assert.equal(identityFromIapClaims({ sub: 'accounts.google.com:42' }), undefined);
    });

    it('offers a fixed user for local development', async () => {
        const user = { email: 'dev@example.com', subject: 'dev' };
        assert.deepEqual(await new FixedIdentityProvider(user).identify(), user);
    });
});

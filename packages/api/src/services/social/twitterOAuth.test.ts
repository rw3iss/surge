import { describe, expect, it, } from 'vitest';
import { percentEncode, sign, signatureBaseString, } from './twitterOAuth';

// Twitter's documented "Creating a signature" example — the base string here is
// byte-identical to the one published at
// https://developer.x.com/en/docs/authentication/oauth-1-0a/creating-a-signature
// The expected signature is the HMAC-SHA1 of that base string under the
// documented signing key, independently confirmed with:
//   printf '%s' "<base>" | openssl dgst -sha1 -hmac "<consumerSecret>&<tokenSecret>" -binary | base64
const VECTOR = {
    method: 'POST',
    baseUrl: 'https://api.twitter.com/1.1/statuses/update.json',
    params: {
        status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
        include_entities: 'true',
        oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
        oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: '1318622958',
        oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
        oauth_version: '1.0',
    },
    consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kzoK',
    tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
    expectedSignature: '9FUM8Y/DJaBJFjS3pJ0PyxG3OqU=',
};

describe('percentEncode', () => {
    it('encodes per RFC 3986 (escapes ! but not ~)', () => {
        expect(percentEncode('Ladies + Gentlemen',),).toBe('Ladies%20%2B%20Gentlemen',);
        expect(percentEncode('a!b~c',),).toBe('a%21b~c',);
    },);
},);

describe('signatureBaseString', () => {
    it('matches the documented base string', () => {
        const base = signatureBaseString(VECTOR.method, VECTOR.baseUrl, VECTOR.params,);
        expect(base,).toContain('POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json&',);
        expect(base,).toContain('oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog',);
        expect(base,).toContain('status%3DHello%2520Ladies%2520%252B%2520Gentlemen',);
    },);
},);

describe('sign', () => {
    it('reproduces the documented HMAC-SHA1 signature', () => {
        const sig = sign(
            VECTOR.method,
            VECTOR.baseUrl,
            VECTOR.params,
            VECTOR.consumerSecret,
            VECTOR.tokenSecret,
        );
        expect(sig,).toBe(VECTOR.expectedSignature,);
    },);
},);

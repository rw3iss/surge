/**
 * Minimal OAuth 1.0a (HMAC-SHA1) user-context signer for X/Twitter writes.
 * Hand-rolled on Node `crypto` — no third-party dependency — so we own the
 * exact encoding. Only what POSSE publishing needs: sign a request and build
 * the `Authorization: OAuth …` header.
 *
 * Verified against Twitter's documented example
 * (developer.x.com "Creating a signature"): signature `hCtSmYh+iHYCEqBWrE7C7hYmtUk=`.
 */
import crypto from 'crypto';

export interface TwitterUserCreds {
    apiKey: string; // consumer key
    apiSecret: string; // consumer secret
    accessToken: string; // user access token
    accessSecret: string; // user access token secret
}

/** RFC 3986 percent-encoding (stricter than encodeURIComponent). */
export function percentEncode(str: string,): string {
    return encodeURIComponent(str,).replace(
        /[!*'()]/g,
        (c,) => '%' + c.charCodeAt(0,).toString(16,).toUpperCase(),
    );
}

/** Build the OAuth 1.0a signature base string. */
export function signatureBaseString(
    method: string,
    baseUrl: string,
    params: Record<string, string>,
): string {
    const encoded = Object.keys(params,)
        .map((k,) => [percentEncode(k,), percentEncode(params[k],),] as const,)
        .sort((a, b,) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)),)
        .map(([k, v],) => `${k}=${v}`,)
        .join('&',);
    return [
        method.toUpperCase(),
        percentEncode(baseUrl,),
        percentEncode(encoded,),
    ].join('&',);
}

/** Compute the base64 HMAC-SHA1 `oauth_signature`. */
export function sign(
    method: string,
    baseUrl: string,
    params: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string,
): string {
    const base = signatureBaseString(method, baseUrl, params,);
    const key = `${percentEncode(consumerSecret,)}&${percentEncode(tokenSecret,)}`;
    return crypto.createHmac('sha1', key,).update(base,).digest('base64',);
}

/**
 * Build an `Authorization: OAuth …` header for a request. `extraParams` are
 * request params that participate in the signature (query params, or
 * form-encoded body params). JSON bodies contribute nothing per the spec, so
 * pass `{}` for a JSON POST.
 */
export function buildAuthHeader(
    method: string,
    url: string,
    extraParams: Record<string, string>,
    creds: TwitterUserCreds,
    // Injectable for tests; defaults to live values in production.
    nonce: string = crypto.randomBytes(16,).toString('hex',),
    timestamp: string = Math.floor(Date.now() / 1000,).toString(),
): string {
    const oauthParams: Record<string, string> = {
        oauth_consumer_key: creds.apiKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_token: creds.accessToken,
        oauth_version: '1.0',
    };

    // Sign over oauth params + any query/body params (base URL sans query).
    const [baseUrl,] = url.split('?', 1,);
    const signature = sign(
        method,
        baseUrl,
        { ...oauthParams, ...extraParams, },
        creds.apiSecret,
        creds.accessSecret,
    );

    const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature, };
    const header = Object.keys(headerParams,)
        .sort()
        .map((k,) => `${percentEncode(k,)}="${percentEncode(headerParams[k],)}"`,)
        .join(', ',);
    return `OAuth ${header}`;
}

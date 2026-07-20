/**
 * Compose & cross-post (POSSE). Publishes text to a provider's write API and
 * captures the created post back into `social_posts` (source='posse') so it
 * renders in the feed immediately.
 *
 * X/Twitter uses the FREE write tier (`POST /2/tweets`) with user-context
 * OAuth 1.0a. Other providers are stubbed until their publish flow lands.
 * Media upload is a follow-up (X v1.1 chunked upload).
 */
import type { SocialPlatform, } from '@sitesurge/types';
import { query, } from '../../db';
import { cache, } from '../cache';
import { logger, } from '../../utils/logger';
import { upsertSocialPost, } from '../social';
import { fetchTweetById, } from './twitterHydrate';
import { buildAuthHeader, type TwitterUserCreds, } from './twitterOAuth';

export interface PublishInput {
    providers: SocialPlatform[];
    text: string;
}

export interface PublishResult {
    provider: SocialPlatform;
    ok: boolean;
    id?: string;
    error?: string;
}

/** Load X user-context write credentials from the stored connection. */
async function getTwitterCreds(): Promise<TwitterUserCreds | null> {
    const res = await query(
        `SELECT credentials FROM social_connections WHERE provider = 'twitter'`,
    );
    const c = res.rows[0]?.credentials;
    if (!c?.apiKey || !c?.apiSecret || !c?.accessToken || !c?.accessSecret) return null;
    return {
        apiKey: c.apiKey,
        apiSecret: c.apiSecret,
        accessToken: c.accessToken,
        accessSecret: c.accessSecret,
    };
}

async function publishToTwitter(text: string, userId?: string | null,): Promise<PublishResult> {
    const creds = await getTwitterCreds();
    if (!creds) {
        return {
            provider: 'twitter',
            ok: false,
            error: 'X write credentials missing. Add API key/secret + access token/secret in Configuration.',
        };
    }

    const url = 'https://api.twitter.com/2/tweets';
    try {
        // JSON body → no body params participate in the OAuth signature.
        const authHeader = buildAuthHeader('POST', url, {}, creds,);
        const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json', },
            body: JSON.stringify({ text, },),
        },);

        if (!res.ok) {
            const body = await res.text().catch(() => '',);
            logger.warn('X publish failed', { status: res.status, body: body.slice(0, 300,), },);
            return { provider: 'twitter', ok: false, error: `X API ${res.status}: ${body.slice(0, 200,)}`, };
        }

        const json = await res.json() as { data?: { id?: string; }; };
        const id = json.data?.id;
        if (!id) return { provider: 'twitter', ok: false, error: 'X API returned no tweet id.', };

        // Capture the new tweet into the feed as a POSSE post. Hydrate for a rich
        // card; fall back to a minimal row if the syndication read isn't ready.
        const hydrated = await fetchTweetById(id,);
        const postUrl = `https://x.com/i/status/${id}`;
        await upsertSocialPost('twitter', hydrated ?? {
            id,
            content: text,
            mediaUrl: postUrl,
            publishedAt: new Date(0,),
            rawData: { posse: true, },
        }, { source: 'posse', postUrl, createdBy: userId ?? null, },).catch((error,) =>
            logger.warn('POSSE capture upsert failed', { id, error, },));

        await cache.invalidateSocialCache();
        return { provider: 'twitter', ok: true, id, };
    } catch (error) {
        logger.error('X publish error', { error, },);
        return { provider: 'twitter', ok: false, error: error instanceof Error ? error.message : 'Publish failed', };
    }
}

/** Publish `text` to each requested provider. Partial success is normal. */
export async function publishPost(
    input: PublishInput,
    ctx?: { userId?: string | null; },
): Promise<PublishResult[]> {
    const results: PublishResult[] = [];
    for (const provider of input.providers) {
        if (provider === 'twitter') {
            results.push(await publishToTwitter(input.text, ctx?.userId,),);
        } else {
            results.push({
                provider,
                ok: false,
                error: `Publishing to ${provider} isn't supported yet.`,
            },);
        }
    }
    return results;
}

/**
 * CMS-specific `TemplateRuntime` factory: wires the pure engine to the client
 * SDK (`cms.*`). Provides the base context (user, site, page-entity) and the
 * function resolver registry (entity fetchers, collections, counts, utilities).
 *
 * All fetches are cached per-runtime (per render) and never throw — a missing
 * entity resolves to an EntityRef with `data: null`, so downstream property
 * access is simply ignored (with a console warning).
 */
import { formatCurrency, formatDate, formatNumber, truncate as truncateStr, } from '@sitesurge/types';
import { cms, } from '../cmsClient';
import { entityRef, type TemplateRuntime, } from './index';

export interface RuntimeOptions {
    /** Entity variables to expose at the root (e.g. `{ post: <Post> }`), wrapped
     *  as EntityRefs so `{{post.title}}` reads a property and `{{post}}` renders
     *  the whole entity. Pass the raw entity objects; they're wrapped here. */
    entities?: Record<string, { kind: string; data: Record<string, unknown> | null; id?: string } | null>;
    /** Current user (from the auth store) for `{{user.*}}` / `user()`. */
    user?: Record<string, unknown> | null;
    /** Public site settings for `{{site.*}}`. */
    site?: Record<string, unknown> | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fetch an entity by id (UUID) or slug, trying the likely method first and
 *  falling back to the other. Returns the raw entity object or null. */
async function fetchEntity(kind: string, ref: string): Promise<Record<string, unknown> | null> {
    const byId = UUID_RE.test(ref);
    const attempt = async (mode: 'id' | 'slug'): Promise<Record<string, unknown> | null> => {
        try {
            switch (kind) {
                case 'post':
                    return (mode === 'id' ? await cms.posts.getById(ref) : await cms.posts.getBySlug(ref)) as unknown as Record<string, unknown>;
                case 'campaign':
                    return (mode === 'id' ? await cms.campaigns.getById(ref) : await cms.campaigns.getBySlug(ref)) as unknown as Record<string, unknown>;
                case 'form':
                    return (mode === 'id' ? await cms.forms.getById(ref) : await cms.forms.getBySlug(ref)) as unknown as Record<string, unknown>;
                case 'page':
                    return (mode === 'id' ? await cms.pages.getById(ref) : await cms.pages.getBySlug(ref)) as unknown as Record<string, unknown>;
                case 'media':
                    return mode === 'id' ? (await cms.media.getById(ref)) as unknown as Record<string, unknown> : null;
                default:
                    return null;
            }
        } catch {
            return null;
        }
    };
    const first = await attempt(byId ? 'id' : 'slug');
    if (first) return first;
    // Fallback to the other lookup (e.g. a slug that looks id-ish, or vice-versa).
    return attempt(byId ? 'slug' : 'id');
}

async function fetchList(kind: string, limit: number): Promise<{ items: Record<string, unknown>[]; total: number }> {
    try {
        switch (kind) {
            case 'posts': {
                const r = await cms.posts.list({ limit } as never);
                return { items: (r.data ?? []) as unknown as Record<string, unknown>[], total: r.meta?.total ?? r.data?.length ?? 0 };
            }
            case 'campaigns': {
                const data = (await cms.campaigns.listPublic({ limit } as never)) as unknown as Record<string, unknown>[];
                return { items: data ?? [], total: data?.length ?? 0 };
            }
            case 'forms': {
                const data = (await cms.forms.listPublic({ limit } as never)) as unknown as Record<string, unknown>[];
                return { items: data ?? [], total: data?.length ?? 0 };
            }
            default:
                return { items: [], total: 0 };
        }
    } catch {
        return { items: [], total: 0 };
    }
}

/** Map the collection function name → its element entity kind. */
const COLLECTION_KIND: Record<string, string> = { posts: 'post', campaigns: 'campaign', forms: 'form' };

export function buildRuntime(opts: RuntimeOptions = {}): TemplateRuntime {
    const cache = new Map<string, Promise<unknown>>();
    const memo = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
        let p = cache.get(key) as Promise<T> | undefined;
        if (!p) { p = fn(); cache.set(key, p); }
        return p;
    };

    // Root context: page entities (wrapped) + user + site.
    const context: Record<string, unknown> = {};
    for (const [name, ent] of Object.entries(opts.entities ?? {})) {
        if (ent) context[name] = entityRef(ent.kind, ent.data, ent.id);
    }
    if (opts.user) context.user = opts.user;
    if (opts.site) context.site = opts.site;

    const s = (v: unknown): string => (v == null ? '' : String(v));

    const resolve = async (name: string, args: unknown[]): Promise<unknown> => {
        switch (name) {
            // ── single entities ──
            case 'post':
            case 'campaign':
            case 'form':
            case 'page':
            case 'media': {
                const ref = s(args[0]).trim();
                if (!ref) return entityRef(name, null);
                const data = await memo(`${name}:${ref}`, () => fetchEntity(name, ref));
                return entityRef(name, data, ref);
            }
            case 'user':
                return entityRef('user', (opts.user ?? null) as Record<string, unknown> | null);

            // ── collections (arrays of EntityRefs) ──
            case 'posts':
            case 'campaigns':
            case 'forms': {
                const limit = typeof args[0] === 'number' ? (args[0] as number) : 20;
                const kind = COLLECTION_KIND[name];
                const { items } = await memo(`${name}:${limit}`, () => fetchList(name, limit));
                return items.map((it) => entityRef(kind, it, s(it.id ?? it.slug)));
            }

            // ── counts / convenience ──
            case 'postCount': return (await memo('postCount', () => fetchList('posts', 1))).total;
            case 'campaignCount': return (await memo('campaignCount', () => fetchList('campaigns', 200))).total;
            case 'formCount': return (await memo('formCount', () => fetchList('forms', 200))).total;
            case 'now': return new Date();
            case 'year': return new Date().getFullYear();

            // ── string / value utilities ──
            case 'upper': return s(args[0]).toUpperCase();
            case 'lower': return s(args[0]).toLowerCase();
            case 'truncate': return truncateStr(s(args[0]), typeof args[1] === 'number' ? (args[1] as number) : 100);
            case 'formatCurrency': return formatCurrency(Number(args[0]) || 0, args[1] ? s(args[1]) : undefined);
            case 'formatDate': return args[0] ? formatDate(args[0] as string | Date) : '';
            case 'formatNumber': return formatNumber(Number(args[0]) || 0);
            case 'default': return args[0] == null || args[0] === '' ? args[1] : args[0];

            default:
                return undefined;
        }
    };

    return {
        context,
        resolve,
        warn: (m) => { if (typeof console !== 'undefined') console.warn(m); },
    };
}

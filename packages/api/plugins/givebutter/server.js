'use strict';
/**
 * GiveButter plugin — server hooks + backend actions. The admin invokes actions
 * via POST /api/v1/plugins/givebutter/action/:action. All GiveButter API access
 * uses the secret apiKey (never sent to the browser — declared type:'secret' in
 * plugin.json). Every action normalizes errors to { ok:false, status, error }
 * instead of throwing raw, so the admin UI can surface a clear message and detect
 * a broken/missing campaign rather than seeing an opaque 500.
 */
const DEFAULT_BASE = 'https://api.givebutter.com/v1';

function cfg(ctx) {
    const c = ctx.config || {};
    return {
        apiKey: String(c.apiKey || ''),
        accountId: String(c.accountId || ''),
        base: String(c.apiBaseUrl || DEFAULT_BASE).replace(/\/$/, ''),
    };
}

/** Single choke-point for GiveButter REST calls. Returns a normalized envelope. */
async function gb(ctx, method, path, body) {
    const { apiKey, base } = cfg(ctx);
    if (!apiKey) return { ok: false, status: 0, error: 'GiveButter API key is not configured' };
    let res;
    try {
        res = await ctx.http(`${base}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (e) {
        return { ok: false, status: 0, error: `Network error reaching GiveButter: ${e && e.message}` };
    }
    if (res.status === 204) return { ok: true, status: 204, data: null };
    let json = null;
    try { json = await res.json(); } catch (_) { /* non-JSON body */ }
    if (!res.ok) {
        const msg = (json && (json.message || json.error)) || res.statusText || `HTTP ${res.status}`;
        return { ok: false, status: res.status, error: msg, details: json };
    }
    return { ok: true, status: res.status, data: json };
}

/** Reduce a GiveButter campaign to the fields our UI needs. */
function pickCampaign(c) {
    if (!c || typeof c !== 'object') return null;
    return {
        id: c.id, code: c.code, title: c.title, description: c.description,
        goal: c.goal, raised: c.raised, donors: c.donors, url: c.url,
        status: c.status, currency: c.currency, end_at: c.end_at,
    };
}

/** Unwrap `{ data: {...} }` or a bare object from a GiveButter single-resource response. */
function unwrapOne(data) {
    return data && typeof data === 'object' && 'data' in data ? data.data : data;
}

module.exports = {
    async install(ctx) { ctx.logger.info('GiveButter plugin installed.'); },
    async onEnable(ctx) { ctx.logger.info('GiveButter enabled.'); },
    async onDisable(ctx) { ctx.logger.info('GiveButter disabled.'); },
    async onLoad() { /* no server runtime — the donation widget is client-side */ },
    async update(ctx) {
        return {
            fromVersion: ctx.installedVersion || ctx.version,
            toVersion: ctx.version,
            migrated: false,
            notes: 'No migration for this version.',
        };
    },

    validateConfig(config) {
        const errors = {};
        if (config.apiKey !== undefined && !String(config.apiKey || '').trim()) {
            errors.apiKey = 'API key is required';
        }
        if (config.accountId !== undefined && !String(config.accountId || '').trim()) {
            errors.accountId = 'Widget Account ID is required';
        }
        if (config.apiBaseUrl && !/^https?:\/\//i.test(String(config.apiBaseUrl))) {
            errors.apiBaseUrl = 'Must be an http(s) URL';
        }
        return { ok: Object.keys(errors).length === 0, errors };
    },

    actions: {
        // Verify credentials by listing the first page of campaigns.
        async testConnection(ctx) {
            const r = await gb(ctx, 'GET', '/campaigns?page=1');
            if (!r.ok) return { ok: false, status: r.status, error: r.error };
            const list = (r.data && r.data.data) || [];
            return {
                ok: true,
                accountId: cfg(ctx).accountId,
                campaignCount: Array.isArray(list) ? list.length : 0,
            };
        },

        async listCampaigns(ctx, payload) {
            const page = payload && payload.page ? Number(payload.page) : 1;
            const scope = payload && payload.scope ? `&scope=${encodeURIComponent(String(payload.scope))}` : '';
            const r = await gb(ctx, 'GET', `/campaigns?page=${page}${scope}`);
            if (!r.ok) return r;
            const items = ((r.data && r.data.data) || []).map(pickCampaign).filter(Boolean);
            return { ok: true, campaigns: items, meta: (r.data && r.data.meta) || null };
        },

        async getCampaign(ctx, payload) {
            const id = payload && payload.id;
            if (!id) return { ok: false, status: 400, error: 'campaign id required' };
            const r = await gb(ctx, 'GET', `/campaigns/${encodeURIComponent(String(id))}`);
            if (!r.ok) return r;
            return { ok: true, campaign: pickCampaign(unwrapOne(r.data)) };
        },

        async createCampaign(ctx, payload) {
            const body = {
                title: String((payload && payload.title) || '').trim(),
                type: (payload && payload.type) || 'standard',
            };
            if (!body.title) return { ok: false, status: 400, error: 'title required' };
            if (payload && payload.goal != null) body.goal = Number(payload.goal);
            if (payload && payload.description) body.description = String(payload.description);
            if (payload && payload.end_at) body.end_at = String(payload.end_at);
            const r = await gb(ctx, 'POST', '/campaigns', body);
            if (!r.ok) return r;
            return { ok: true, campaign: pickCampaign(unwrapOne(r.data)) };
        },

        async updateCampaign(ctx, payload) {
            const id = payload && payload.id;
            if (!id) return { ok: false, status: 400, error: 'campaign id required' };
            const body = {};
            for (const k of ['title', 'goal', 'description', 'end_at']) {
                if (payload[k] !== undefined) body[k] = k === 'goal' ? Number(payload[k]) : payload[k];
            }
            const r = await gb(ctx, 'PATCH', `/campaigns/${encodeURIComponent(String(id))}`, body);
            if (!r.ok) return r;
            return { ok: true, campaign: pickCampaign(unwrapOne(r.data)) };
        },

        async deleteCampaign(ctx, payload) {
            const id = payload && payload.id;
            if (!id) return { ok: false, status: 400, error: 'campaign id required' };
            const r = await gb(ctx, 'DELETE', `/campaigns/${encodeURIComponent(String(id))}`);
            return r.ok ? { ok: true } : r;
        },

        // Health probe for a linked campaign: does it still exist + is it live?
        async checkCampaign(ctx, payload) {
            const id = payload && payload.id;
            if (!id) return { ok: false, status: 400, error: 'campaign id required' };
            const r = await gb(ctx, 'GET', `/campaigns/${encodeURIComponent(String(id))}`);
            if (!r.ok) return { ok: false, status: r.status, error: r.error, exists: r.status !== 404 };
            const c = pickCampaign(unwrapOne(r.data));
            return { ok: true, exists: true, code: c && c.code, status: c && c.status, campaign: c };
        },
    },
};

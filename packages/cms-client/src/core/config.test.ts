import { describe, expect, it, } from 'vitest';
import { resolveConfig, } from './config';

describe('resolveConfig', () => {
    it('requires baseUrl and derives apiBase', () => {
        const c = resolveConfig({ baseUrl: 'https://cms.example.com/', },);
        expect(c.baseUrl,).toBe('https://cms.example.com',); // trailing slash trimmed
        expect(c.apiBase,).toBe('https://cms.example.com/api/v1',);
    },);
    it('defaults: bearer mode, cache enabled, default ttl/retry/timeout', () => {
        const c = resolveConfig({ baseUrl: 'http://x', },);
        expect(c.authMode,).toBe('bearer',);
        expect(c.cacheEnabled,).toBe(true,);
        expect(c.ttl.list,).toBe(30_000,);
        expect(c.retry.attempts,).toBe(3,);
        expect(c.timeoutMs,).toBe(30_000,);
        expect(c.storageKey,).toBe('cms.auth',);
    },);
    it('cache:false disables caching', () => {
        expect(resolveConfig({ baseUrl: 'http://x', cache: false, },).cacheEnabled,).toBe(false,);
    },);
    it('apiKey presence selects apiKey mode unless mode set', () => {
        const c = resolveConfig({ baseUrl: 'http://x', auth: { apiKey: 'ssk_1', }, },);
        expect(c.authMode,).toBe('apiKey',);
        expect(c.apiKey,).toBe('ssk_1',);
    },);
    it('merges partial ttl and retry over defaults', () => {
        const c = resolveConfig({ baseUrl: 'http://x', cache: { ttl: { list: 5, }, }, retry: { attempts: 1, }, },);
        expect(c.ttl.list,).toBe(5,);
        expect(c.ttl.entity,).toBe(60_000,);
        expect(c.retry.attempts,).toBe(1,);
        expect(c.retry.backoffMs,).toBe(300,);
    },);
},);

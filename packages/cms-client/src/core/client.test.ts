import { describe, expect, it, vi, } from 'vitest';
import { CmsClientCore, } from './client';

function envelope(data: unknown, status = 200,) {
    return new Response(JSON.stringify({ success: status < 400, data, },), { status, headers: { 'content-type': 'application/json', }, },);
}
function errorEnvelope(code: string, message: string, status: number,) {
    return new Response(JSON.stringify({ success: false, error: { code, message, }, },), { status, headers: { 'content-type': 'application/json', }, },);
}

describe('CmsClientCore', () => {
    it('caches a GET — second send is served from cache (one fetch)', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(envelope([{ id: 'p', },],),);
        const core = new CmsClientCore({ baseUrl: 'http://api', fetch: fetchImpl, auth: { store: null, }, },);
        await core.send({ module: 'posts', method: 'GET', path: '/posts', query: { page: 1, }, },);
        await core.send({ module: 'posts', method: 'GET', path: '/posts', query: { page: 1, }, },);
        expect(fetchImpl,).toHaveBeenCalledOnce();
    },);

    it('a mutation invalidates the list cache', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(envelope([{ id: '1', },],),)   // first GET
            .mockResolvedValueOnce(envelope({ id: '2', }, 201,),) // POST
            .mockResolvedValueOnce(envelope([{ id: '1', }, { id: '2', },],),); // GET after invalidation
        const core = new CmsClientCore({ baseUrl: 'http://api', fetch: fetchImpl, auth: { store: null, }, },);
        await core.send({ module: 'posts', method: 'GET', path: '/posts', },);
        await core.send({ module: 'posts', method: 'POST', path: '/posts', body: { t: 'x', }, invalidates: ['posts',], } as never,);
        await core.send({ module: 'posts', method: 'GET', path: '/posts', },);
        expect(fetchImpl,).toHaveBeenCalledTimes(3,);
    },);

    it('emits on the error bus and rejects with the typed error', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(errorEnvelope('NOT_FOUND', 'nope', 404,),);
        const core = new CmsClientCore({ baseUrl: 'http://api', fetch: fetchImpl, auth: { store: null, }, },);
        const onErr = vi.fn(); core.onError(onErr,);
        await expect(core.send({ module: 'posts', method: 'GET', path: '/posts/x', },),).rejects.toThrow('nope',);
        expect(onErr,).toHaveBeenCalled();
    },);

    it('refreshes once on an expired bearer token then retries', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(errorEnvelope('UNAUTHORIZED', 'Token expired', 401,),) // first protected GET
            .mockResolvedValueOnce(envelope({ user: { id: 'u', }, accessToken: 'A2', refreshToken: 'R2', expiresAt: 'l', },),) // refresh
            .mockResolvedValueOnce(envelope({ id: 'me', },),); // retry
        const core = new CmsClientCore({
            baseUrl: 'http://api', fetch: fetchImpl,
            auth: { mode: 'bearer', tokens: { accessToken: 'A', refreshToken: 'R', }, store: null, },
        },);
        const out = await core.send({ module: 'users', method: 'GET', path: '/users/me', options: { cache: false, }, },);
        expect(out,).toEqual({ id: 'me', },);
        expect(fetchImpl,).toHaveBeenCalledTimes(3,);
    },);
},);

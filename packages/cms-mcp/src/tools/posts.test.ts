import { describe, expect, it, vi, } from 'vitest';
import { postTools, } from './posts';
import type { ToolContext, ToolDef, } from '../tool';

/** Look up a tool by name from the exported registry. */
function tool(name: string,): ToolDef {
    const t = postTools.find((x,) => x.name === name,);
    if (!t) throw new Error(`no tool ${name}`,);
    return t;
}

/** Build a ToolContext whose cms.posts.* are vi.fn() mocks. */
function mockCtx(overrides: Record<string, unknown> = {},) {
    const posts = {
        list: vi.fn(),
        search: vi.fn(),
        getById: vi.fn(),
        getBySlug: vi.fn(),
        create: vi.fn().mockImplementation(async (body: unknown,) => body,),
        update: vi.fn().mockImplementation(async (_id: string, body: unknown,) => body,),
        remove: vi.fn(),
        bulk: vi.fn(),
        reorderBlocks: vi.fn(),
        listRevisions: vi.fn(),
        restoreRevision: vi.fn(),
        ...overrides,
    };
    const ctx = {
        cms: { posts, },
        readonly: false,
        config: { baseUrl: 'http://x', apiKeyPreview: 'ssk_…', },
    } as unknown as ToolContext;
    return { ctx, posts, };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (t: ToolDef, args: any, ctx: ToolContext,) => t.handler(args, ctx,);

describe('create_post', () => {
    it('maps blocks → contentBlocks with a sort_order sequence + ids', async () => {
        const { ctx, posts, } = mockCtx();
        await call(tool('create_post',), {
            slug: 's', title: 'T',
            blocks: [
                { type: 'rich_text', content: '<p>a</p>', },
                { type: 'spacer', settings: { height: '20px', }, },
            ],
        }, ctx,);

        const [body,] = posts.create.mock.calls[0];
        expect(body.slug,).toBe('s',);
        expect(body.contentBlocks,).toHaveLength(2,);
        expect(body.contentBlocks[0].sort_order,).toBe(0,);
        expect(body.contentBlocks[1].sort_order,).toBe(1,);
        expect(typeof body.contentBlocks[0].id,).toBe('string',);
        expect(body.contentBlocks[0].id.length,).toBeGreaterThan(0,);
        expect(body.contentBlocks[0].data.content,).toBe('<p>a</p>',);
        expect(body.contentBlocks[1].data.height,).toBe('20px',);
        // no `blocks` key leaks into the create body
        expect('blocks' in body,).toBe(false,);
    },);

    it('rejects a page-only (group) block type', async () => {
        const { ctx, } = mockCtx();
        await expect(call(tool('create_post',), {
            slug: 's', title: 'T', blocks: [{ type: 'group', },],
        }, ctx,),).rejects.toThrow(/page-only/,);
    },);
},);

describe('add_post_block', () => {
    it('read-modify-write: 2 existing → 3 blocks resequenced, ids preserved, sortOrder→sort_order', async () => {
        const { ctx, posts, } = mockCtx({
            getById: vi.fn().mockResolvedValue({
                id: 'p1',
                contentBlocks: [
                    { id: 'b1', type: 'rich_text', sortOrder: 0, data: { content: 'one', }, },
                    { id: 'b2', type: 'spacer', sortOrder: 1, data: { height: '10px', }, },
                ],
            },),
        },);
        await call(tool('add_post_block',), {
            id: 'p1', block: { type: 'html', content: '<b>x</b>', }, index: 1,
        }, ctx,);

        expect(posts.getById,).toHaveBeenCalledWith('p1',);
        const [id, body,] = posts.update.mock.calls[0];
        expect(id,).toBe('p1',);
        const cb = body.contentBlocks;
        expect(cb,).toHaveLength(3,);
        // inserted at index 1
        expect(cb[0].id,).toBe('b1',);
        expect(cb[1].type,).toBe('html',);
        expect(cb[2].id,).toBe('b2',);
        // existing ids preserved, new one generated
        expect(typeof cb[1].id,).toBe('string',);
        expect(cb[1].id.length,).toBeGreaterThan(0,);
        // resequenced + snake_case sort_order
        expect(cb.map((b: { sort_order: number; },) => b.sort_order,),).toEqual([0, 1, 2,],);
    },);

    it('appends at the end when index omitted', async () => {
        const { ctx, posts, } = mockCtx({
            getById: vi.fn().mockResolvedValue({
                id: 'p1',
                contentBlocks: [{ id: 'b1', type: 'rich_text', sortOrder: 0, data: {}, },],
            },),
        },);
        await call(tool('add_post_block',), { id: 'p1', block: { type: 'spacer', }, }, ctx,);
        const [, body,] = posts.update.mock.calls[0];
        expect(body.contentBlocks,).toHaveLength(2,);
        expect(body.contentBlocks[1].type,).toBe('spacer',);
    },);
},);

describe('update_post_block', () => {
    it('merges only provided fields into the target block, leaves siblings intact', async () => {
        const { ctx, posts, } = mockCtx({
            getById: vi.fn().mockResolvedValue({
                id: 'p1',
                contentBlocks: [
                    { id: 'b1', type: 'rich_text', sortOrder: 0, data: { content: 'old', title: 'keep', }, },
                    { id: 'b2', type: 'spacer', sortOrder: 1, data: { height: '10px', }, },
                ],
            },),
        },);
        await call(tool('update_post_block',), {
            id: 'p1', blockId: 'b1', content: 'new', settings: { align: 'center', },
        }, ctx,);

        const [, body,] = posts.update.mock.calls[0];
        const [b1, b2,] = body.contentBlocks;
        expect(b1.data.content,).toBe('new',);
        expect(b1.data.title,).toBe('keep',); // untouched provided-only merge
        expect(b1.data.align,).toBe('center',); // settings shallow-merged
        expect(b2.data,).toEqual({ height: '10px', },); // sibling intact
        expect(b1.sort_order,).toBe(0,);
    },);

    it('throws when blockId is not found', async () => {
        const { ctx, } = mockCtx({
            getById: vi.fn().mockResolvedValue({ id: 'p1', contentBlocks: [], },),
        },);
        await expect(call(tool('update_post_block',), { id: 'p1', blockId: 'nope', title: 'x', }, ctx,),)
            .rejects.toThrow(/not found/,);
    },);
},);

describe('delete_post_block', () => {
    it('removes the block and re-sequences the remainder', async () => {
        const { ctx, posts, } = mockCtx({
            getById: vi.fn().mockResolvedValue({
                id: 'p1',
                contentBlocks: [
                    { id: 'b1', type: 'rich_text', sortOrder: 0, data: {}, },
                    { id: 'b2', type: 'spacer', sortOrder: 1, data: {}, },
                    { id: 'b3', type: 'html', sortOrder: 2, data: {}, },
                ],
            },),
        },);
        await call(tool('delete_post_block',), { id: 'p1', blockId: 'b2', }, ctx,);
        const [, body,] = posts.update.mock.calls[0];
        expect(body.contentBlocks.map((b: { id: string; },) => b.id,),).toEqual(['b1', 'b3',],);
        expect(body.contentBlocks.map((b: { sort_order: number; },) => b.sort_order,),).toEqual([0, 1,],);
    },);

    it('throws when blockId is not found', async () => {
        const { ctx, } = mockCtx({
            getById: vi.fn().mockResolvedValue({ id: 'p1', contentBlocks: [], },),
        },);
        await expect(call(tool('delete_post_block',), { id: 'p1', blockId: 'nope', }, ctx,),)
            .rejects.toThrow(/not found/,);
    },);
},);

describe('get_post', () => {
    it('requires exactly one of id/slug', async () => {
        const { ctx, } = mockCtx();
        const t = tool('get_post',);
        await expect(call(t, {}, ctx,),).rejects.toThrow(/exactly one/,);
        await expect(call(t, { id: 'a', slug: 'b', }, ctx,),).rejects.toThrow(/exactly one/,);
    },);

    it('routes id → getById and slug → getBySlug', async () => {
        const { ctx, posts, } = mockCtx();
        const t = tool('get_post',);
        await call(t, { id: 'p1', }, ctx,);
        expect(posts.getById,).toHaveBeenCalledWith('p1',);
        await call(t, { slug: 'hello', preview: 'admin', }, ctx,);
        expect(posts.getBySlug,).toHaveBeenCalledWith('hello', { preview: 'admin', },);
    },);
},);

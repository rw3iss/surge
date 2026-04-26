/**
 * PostListRenderer
 *
 * Renders the output of the `post_list` block. Used by both the public
 * BlockRenderer and the admin BlockPreview so the editor's preview is
 * faithful to the live site.
 *
 * Two independent post sources are supported:
 *
 *   1. Specific posts (pinnedPostIds) — always rendered first when set.
 *      No filter / count limit applies; the operator chose them
 *      explicitly. Order matches the array.
 *
 *   2. Query results — rendered after, only when `queryEnabled` is on.
 *      Honours count / date filters / search. When the query returns
 *      zero rows AND `showEmptyMessage` is on, a "No posts match"
 *      placeholder renders; otherwise nothing.
 *
 * The two lists are deduped against each other so a query hit that's
 * also pinned never renders twice.
 *
 * Brevity modes (apply uniformly to both sources):
 *
 *   brief — title + excerpt + meta (date/tags), nothing more.
 *   short — like brief, plus an abbreviated content section clipped to
 *           a configurable max-height. When `allowExpand` is on, a
 *           gradient "See All" overlay invites the reader to expand
 *           the post inline; while expanded, "Hide All" bars float at
 *           the top and bottom (visible on hover).
 *   full  — render every content block, no clipping or expansion UI.
 */
import type { Block, } from '@rw/shared';
import { Component, createMemo, createResource, createSignal, For, Show, } from 'solid-js';
import { fetchPostList, type PostWithBlocks, } from '../services/postsService';
import { BlockRenderer, } from './BlockRenderer/BlockRenderer';
import './PostListRenderer.scss';

export type PostBrevity = 'brief' | 'short' | 'full';

export interface PostListSettings {
    /** Posts hand-picked via the picker. Always rendered first if set. */
    pinnedPostIds?: string[];
    /** Whether the dynamic query section is active. Defaults to true so
     *  blocks saved before this option existed keep showing query
     *  results. New blocks created via the editor explicitly set this. */
    queryEnabled?: boolean;
    /** When true, the renderer shows "No posts match…" when the query
     *  returns zero rows. When false (the user explicitly silenced it),
     *  the empty query simply renders nothing. Only applies to the
     *  query branch — pinned-only blocks never show this message. */
    showEmptyMessage?: boolean;

    // ─── Query criteria (only used when queryEnabled) ───
    count?: number;
    afterDaysAgo?: number;
    beforeDaysAgo?: number;
    query?: string;

    // ─── Render options (apply to both pinned + query results) ───
    brevity?: PostBrevity;
    shortMaxHeight?: string;
    allowExpand?: boolean;
    showExcerpt?: boolean;
    showDateCreated?: boolean;
    showDateUpdated?: boolean;
    showTags?: boolean;
}

interface PostListRendererProps {
    settings: PostListSettings;
}

interface ResolvedSettings {
    pinnedPostIds: string[];
    queryEnabled: boolean;
    showEmptyMessage: boolean;
    count: number;
    afterDaysAgo?: number;
    beforeDaysAgo?: number;
    query?: string;
    brevity: PostBrevity;
    shortMaxHeight: string;
    allowExpand: boolean;
    showExcerpt: boolean;
    showDateCreated: boolean;
    showDateUpdated: boolean;
    showTags: boolean;
}

function withDefaults(s: PostListSettings,): ResolvedSettings {
    return {
        pinnedPostIds: s.pinnedPostIds ?? [],
        // Default true preserves prior behavior for blocks saved before
        // this toggle existed — they always ran the query implicitly.
        queryEnabled: s.queryEnabled !== false,
        // Default true matches the previous always-on placeholder.
        showEmptyMessage: s.showEmptyMessage !== false,
        count: s.count ?? 5,
        afterDaysAgo: s.afterDaysAgo,
        beforeDaysAgo: s.beforeDaysAgo,
        query: s.query,
        brevity: s.brevity ?? 'brief',
        shortMaxHeight: s.shortMaxHeight ?? '400px',
        allowExpand: s.allowExpand ?? true,
        showExcerpt: s.showExcerpt ?? true,
        showDateCreated: s.showDateCreated ?? true,
        showDateUpdated: s.showDateUpdated ?? false,
        showTags: s.showTags ?? true,
    };
}

function formatDate(d: Date | string | undefined,): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d,) : d;
    if (Number.isNaN(date.getTime(),)) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', },);
}

const PostListRenderer: Component<PostListRendererProps> = (props,) => {
    const resolved = createMemo(() => withDefaults(props.settings,),);

    // ─── Pinned posts: independent fetch keyed by ids only ─────
    // No date / search filters apply — the operator chose these
    // explicitly. Limit equals the pinned count so all of them come
    // back. We pass `withBlocks` so short/full brevity modes get the
    // hydrated content.
    const pinnedFilter = createMemo(() => {
        const s = resolved();
        if (s.pinnedPostIds.length === 0) return null;
        return {
            count: s.pinnedPostIds.length,
            ids: s.pinnedPostIds,
            withBlocks: s.brevity !== 'brief',
        };
    },);

    const [pinnedData,] = createResource(pinnedFilter, async (f,) => {
        if (!f) return { posts: [] as PostWithBlocks[], total: 0, };
        return fetchPostList(f,);
    },);

    // ─── Query results: independent fetch with all filter criteria ───
    // Skipped entirely when queryEnabled is off — `null` source means
    // the resource never fires.
    const queryFilter = createMemo(() => {
        const s = resolved();
        if (!s.queryEnabled) return null;
        return {
            count: s.count,
            afterDaysAgo: s.afterDaysAgo,
            beforeDaysAgo: s.beforeDaysAgo,
            search: s.query,
            withBlocks: s.brevity !== 'brief',
        };
    },);

    const [queryData,] = createResource(queryFilter, async (f,) => {
        if (!f) return { posts: [] as PostWithBlocks[], total: 0, };
        return fetchPostList(f,);
    },);

    // ─── Combined render list ─────────────────────────────────
    // Pinned posts first (in their saved order), then any query
    // results not already pinned. Dedup by id so a query hit that's
    // also pinned doesn't render twice.
    const combined = createMemo(() => {
        const s = resolved();
        const pinned = pinnedData()?.posts ?? [];
        const queryRows = s.queryEnabled ? (queryData()?.posts ?? []) : [];
        const seen = new Set(pinned.map(p => (p as any).id as string),);
        const queryUnique = queryRows.filter(p => !seen.has((p as any).id as string,),);
        return { pinned, queryUnique, };
    },);

    const isLoading = () => pinnedData.loading || queryData.loading;

    /** True when the query branch is active AND returned no rows. The
     *  empty message only fires for this case — a pinned-only block or
     *  a query-disabled block with no pins simply renders nothing. */
    const queryReturnedEmpty = () => {
        const s = resolved();
        if (!s.queryEnabled) return false;
        if (queryData.loading) return false;
        return (queryData()?.posts?.length ?? 0) === 0;
    };

    const totalToRender = () => combined().pinned.length + combined().queryUnique.length;

    return (
        <div class="post-list">
            <Show when={isLoading() && totalToRender() === 0}>
                <div class="post-list__loading">Loading posts…</div>
            </Show>

            {/* Pinned section first */}
            <For each={combined().pinned}>
                {(post,) => <PostListItem post={post} settings={resolved()} />}
            </For>

            {/* Query results next, deduped against pinned */}
            <For each={combined().queryUnique}>
                {(post,) => <PostListItem post={post} settings={resolved()} />}
            </For>

            {/* Empty-state placeholder — only when the QUERY branch
                returned nothing AND the operator opted in via
                `showEmptyMessage`. Pinned-only blocks (no query)
                never see this. If pinned posts exist but the query
                came back empty, we still hide the message because the
                output isn't actually "empty" — pinned posts rendered. */}
            <Show
                when={
                    !isLoading()
                    && resolved().showEmptyMessage
                    && queryReturnedEmpty()
                    && combined().pinned.length === 0
                }
            >
                <div class="post-list__empty">No posts match the current filters.</div>
            </Show>
        </div>
    );
};

// ─── Per-post item ─────────────────────────────────────────────

interface PostListItemProps {
    post: PostWithBlocks;
    settings: ReturnType<typeof withDefaults>;
}

const PostListItem: Component<PostListItemProps> = (props,) => {
    const [expanded, setExpanded,] = createSignal(false,);

    const brevity = () => props.settings.brevity;
    const allowExpand = () => props.settings.allowExpand;
    const maxHeight = () => props.settings.shortMaxHeight;

    /** Whether the clipped/See-All UI applies to this item. Only true
     *  when in 'short' mode; 'full' renders without bars and 'brief'
     *  renders no content at all. */
    const isShortMode = () => brevity() === 'short';

    /** Whether the inline content area should clip. In short mode, clip
     *  while collapsed; expand on click if `allowExpand`. In full mode,
     *  never clip. */
    const isClipped = () => isShortMode() && !expanded();

    return (
        <article class={`post-list-item post-list-item--${brevity()}`}>
            {/* ─── Title (always shown) ─── */}
            <h3 class="post-list-item__title">
                <a href={`/posts/${props.post.slug}`}>{props.post.title}</a>
            </h3>

            {/* ─── Top "Hide All" bar — only when expanded in short mode ─── */}
            <Show when={isShortMode() && allowExpand() && expanded()}>
                <button
                    type="button"
                    class="post-list-item__bar post-list-item__bar--top"
                    onClick={() => setExpanded(false,)}
                    aria-label="Collapse post"
                >
                    <span class="post-list-item__bar-arrow">▲</span>
                    <span class="post-list-item__bar-label">Hide all</span>
                    <span class="post-list-item__bar-arrow">▲</span>
                </button>
            </Show>

            {/* ─── Meta row: date(s) + tags ─── */}
            <Show when={props.settings.showDateCreated || props.settings.showDateUpdated || (props.settings.showTags && props.post.tags?.length)}>
                <div class="post-list-item__meta">
                    <Show when={props.settings.showDateCreated}>
                        <span class="post-list-item__date" title="Published">
                            {formatDate(props.post.publishedAt || props.post.createdAt,)}
                        </span>
                    </Show>
                    <Show when={props.settings.showDateUpdated && props.post.updatedAt}>
                        <span class="post-list-item__date post-list-item__date--updated" title="Last updated">
                            Updated {formatDate(props.post.updatedAt,)}
                        </span>
                    </Show>
                    <Show when={props.settings.showTags && props.post.tags?.length}>
                        <span class="post-list-item__tags">
                            <For each={props.post.tags}>
                                {(t,) => <span class="post-list-item__tag">#{t}</span>}
                            </For>
                        </span>
                    </Show>
                </div>
            </Show>

            {/* ─── Excerpt ─── */}
            <Show when={props.settings.showExcerpt && props.post.excerpt}>
                <p class="post-list-item__excerpt">{props.post.excerpt}</p>
            </Show>

            {/* ─── Content (short / full only) ─── */}
            <Show when={brevity() !== 'brief'}>
                <div
                    class={`post-list-item__content ${isClipped() ? 'post-list-item__content--clipped' : ''}`}
                    style={isClipped() ? { 'max-height': maxHeight(), } : {}}
                >
                    <Show
                        when={props.post.contentBlocks && props.post.contentBlocks.length > 0}
                        fallback={
                            // Fall back to the raw content string when no
                            // structured blocks were hydrated (legacy posts).
                            <Show when={props.post.content}>
                                <div class="post-list-item__legacy-content rich-text" innerHTML={props.post.content} />
                            </Show>
                        }
                    >
                        <For each={props.post.contentBlocks}>
                            {(b,) => {
                                // The list endpoint returns blocks shaped per
                                // post_content_blocks (id/type/data). The public
                                // BlockRenderer expects the page-block shape
                                // (settings/title/content). Normalize so the
                                // same renderer handles both.
                                const block: Block = {
                                    id: b.id,
                                    pageId: '',
                                    type: b.type as Block['type'],
                                    title: (b.title as string) || (b.data as any)?.title || null,
                                    content: (b.content as string) || (b.data as any)?.content || null,
                                    settings: ((b.data as any) || b.settings || {}) as Block['settings'],
                                    order: b.sortOrder ?? 0,
                                    isVisible: true,
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                } as Block;
                                return <BlockRenderer block={block} />;
                            }}
                        </For>
                    </Show>

                    {/* ─── Bottom "See all" overlay (short, collapsed) ─── */}
                    <Show when={isShortMode() && allowExpand() && !expanded()}>
                        <button
                            type="button"
                            class="post-list-item__bar post-list-item__bar--bottom post-list-item__bar--see-all"
                            onClick={() => setExpanded(true,)}
                            aria-label="Expand post"
                        >
                            <span class="post-list-item__bar-arrow">▼</span>
                            <span class="post-list-item__bar-label">See all</span>
                            <span class="post-list-item__bar-arrow">▼</span>
                        </button>
                    </Show>
                </div>

                {/* ─── Bottom "Hide all" bar — only when expanded in short mode ─── */}
                <Show when={isShortMode() && allowExpand() && expanded()}>
                    <button
                        type="button"
                        class="post-list-item__bar post-list-item__bar--bottom"
                        onClick={() => setExpanded(false,)}
                        aria-label="Collapse post"
                    >
                        <span class="post-list-item__bar-arrow">▲</span>
                        <span class="post-list-item__bar-label">Hide all</span>
                        <span class="post-list-item__bar-arrow">▲</span>
                    </button>
                </Show>
            </Show>
        </article>
    );
};

export default PostListRenderer;

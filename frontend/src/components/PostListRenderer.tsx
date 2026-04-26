/**
 * PostListRenderer
 *
 * Renders the output of the `post_list` block. Used by both the public
 * BlockRenderer and the admin BlockPreview so the editor's preview is
 * faithful to the live site.
 *
 * Brevity modes:
 *
 *   brief — title + excerpt + meta (date/tags), nothing more.
 *   short — like brief, plus an abbreviated content section clipped to
 *           a configurable max-height. When `allowExpand` is on, a
 *           gradient "See All" overlay invites the reader to expand
 *           the post inline; while expanded, "Hide All" bars float at
 *           the top and bottom (visible on hover).
 *   full  — render every content block, no clipping or expansion UI.
 *
 * Settings shape mirrors `PostListSettings` in PostListBlock.tsx so the
 * settings save/load round-trip stays simple.
 */
import type { Block, } from '@rw/shared';
import { Component, createMemo, createResource, createSignal, For, Match, Show, Switch, } from 'solid-js';
import { fetchPostList, type PostWithBlocks, } from '../services/postsService';
import { BlockRenderer, } from './BlockRenderer/BlockRenderer';
import './PostListRenderer.scss';

export type PostBrevity = 'brief' | 'short' | 'full';

export interface PostListSettings {
    count?: number;
    afterDaysAgo?: number;
    beforeDaysAgo?: number;
    brevity?: PostBrevity;
    shortMaxHeight?: string;
    allowExpand?: boolean;
    showExcerpt?: boolean;
    showDateCreated?: boolean;
    showDateUpdated?: boolean;
    showTags?: boolean;
    query?: string;
    pinnedPostIds?: string[];
}

interface PostListRendererProps {
    settings: PostListSettings;
}

/** Read settings keys with sensible defaults applied per the spec. */
function withDefaults(s: PostListSettings,): Required<Omit<PostListSettings, 'afterDaysAgo' | 'beforeDaysAgo' | 'query'>> & {
    afterDaysAgo?: number;
    beforeDaysAgo?: number;
    query?: string;
} {
    return {
        count: s.count ?? 5,
        afterDaysAgo: s.afterDaysAgo,
        beforeDaysAgo: s.beforeDaysAgo,
        brevity: s.brevity ?? 'brief',
        shortMaxHeight: s.shortMaxHeight ?? '400px',
        allowExpand: s.allowExpand ?? true,
        showExcerpt: s.showExcerpt ?? true,
        showDateCreated: s.showDateCreated ?? true,
        showDateUpdated: s.showDateUpdated ?? false,
        showTags: s.showTags ?? true,
        query: s.query,
        pinnedPostIds: s.pinnedPostIds ?? [],
    };
}

function formatDate(d: Date | string | undefined,): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d,) : d;
    if (Number.isNaN(date.getTime(),)) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', },);
}

const PostListRenderer: Component<PostListRendererProps> = (props,) => {
    // Re-fetch whenever the resolved settings change. Solid's resource
    // tracks the source signal; we feed it the JSON of the normalized
    // filter so equivalent settings (e.g. unset vs explicit defaults)
    // share a single fetch.
    const filterSignal = createMemo(() => {
        const s = withDefaults(props.settings,);
        const needBlocks = s.brevity !== 'brief';
        return {
            count: s.count,
            afterDaysAgo: s.afterDaysAgo,
            beforeDaysAgo: s.beforeDaysAgo,
            search: s.query,
            ids: s.pinnedPostIds.length > 0 ? s.pinnedPostIds : undefined,
            withBlocks: needBlocks,
        };
    },);

    const [data,] = createResource(filterSignal, (f,) => fetchPostList(f,),);

    return (
        <div class="post-list">
            <Show when={data.loading}>
                <div class="post-list__loading">Loading posts…</div>
            </Show>
            <Show when={!data.loading && (data()?.posts?.length ?? 0) === 0}>
                <div class="post-list__empty">No posts match the current filters.</div>
            </Show>
            <Show when={!data.loading && (data()?.posts?.length ?? 0) > 0}>
                <For each={data()!.posts}>
                    {(post,) => <PostListItem post={post} settings={withDefaults(props.settings,)} />}
                </For>
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

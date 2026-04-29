import { Component, createResource, createSignal, For, Show, } from 'solid-js';
import { api, } from '../../../../services/api';
import Pagination from '../../common/Pagination';

interface SocialMediaBlockProps {
    data: Record<string, any>;
    mode: 'view' | 'edit';
    onUpdate: (data: Record<string, any>,) => void;
}

const PROVIDERS = ['instagram', 'facebook', 'tiktok', 'youtube', 'twitter',];
const SORT_OPTIONS = [
    { value: 'date', label: 'Date', },
    { value: 'likes', label: 'Likes', },
    { value: 'comments', label: 'Comments', },
];

const SocialMediaBlock: Component<SocialMediaBlockProps> = (props,) => {
    const [selectedProvider, setSelectedProvider,] = createSignal(props.data.provider || '',);
    const [page, setPage,] = createSignal(1,);
    const [sort, setSort,] = createSignal('date',);
    const [sortDir, setSortDir,] = createSignal<'desc' | 'asc'>('desc',);
    const [search, setSearch,] = createSignal('',);
    const [searchInput, setSearchInput,] = createSignal('',);
    const LIMIT = 12;

    // Build a reactive key that changes when any filter/page changes.
    // The key drives the createResource refetch.
    const fetchKey = () => {
        const provider = selectedProvider();
        if (!provider) return '';
        return `${provider}:${page()}:${sort()}:${sortDir()}:${search()}`;
    };

    const [result,] = createResource(fetchKey, async (key,) => {
        if (!key) return null;
        const provider = selectedProvider();
        const params = new URLSearchParams({
            page: String(page(),),
            limit: String(LIMIT,),
            sort: sort(),
            sortDir: sortDir(),
        },);
        const q = search().trim();
        if (q) params.set('search', q,);

        const response = await api.get(`/social/posts/${provider}?${params.toString()}`,);
        if (!response.success) return null;
        return {
            posts: (response as any).data || [],
            meta: (response as any).meta || { total: 0, totalPages: 1, page: 1, limit: LIMIT, },
        };
    },);

    const posts = () => result()?.posts || [];
    const meta = () => result()?.meta || { total: 0, totalPages: 1, page: 1, limit: LIMIT, };

    const handleProviderChange = (provider: string,) => {
        setSelectedProvider(provider,);
        setPage(1,);
        setSearch('',);
        setSearchInput('',);
    };

    const handleSearchSubmit = () => {
        setSearch(searchInput(),);
        setPage(1,);
    };

    const selectPost = (post: any,) => {
        props.onUpdate({
            provider: selectedProvider(),
            postId: post.externalId || post.id,
            postUrl: post.mediaUrl,
            thumbnailUrl: post.thumbnailUrl,
            content: post.content || '',
            showComments: props.data.showComments || false,
            authorName: post.authorName,
        },);
    };

    return (
        <div class="block-social-media">
            <Show
                when={props.mode === 'edit'}
                fallback={
                    <div class="block-social-media__preview">
                        <Show
                            when={props.data.postUrl}
                            fallback={
                                <span class="block-text__empty">
                                    No social media post selected. Click Edit to choose one.
                                </span>
                            }
                        >
                            <div class="block-social-media__selected">
                                <Show when={props.data.thumbnailUrl}>
                                    <img src={props.data.thumbnailUrl} alt="" class="block-social-media__thumb" />
                                </Show>
                                <div class="block-social-media__details">
                                    <span class="badge badge--info">{props.data.provider}</span>
                                    <p>
                                        {props.data.content?.substring(0, 120,)}
                                        {props.data.content?.length > 120 ? '...' : ''}
                                    </p>
                                </div>
                            </div>
                        </Show>
                    </div>
                }
            >
                {/* Provider selector */}
                <div class="form-group">
                    <label>Provider</label>
                    <select
                        value={selectedProvider()}
                        onChange={(e,) => handleProviderChange(e.currentTarget.value,)}
                    >
                        <option value="">Select a provider...</option>
                        <For each={PROVIDERS}>
                            {(p,) => (
                                <option value={p}>
                                    {p.charAt(0,).toUpperCase() + p.slice(1,)}
                                </option>
                            )}
                        </For>
                    </select>
                </div>

                {/* Search / Sort / Grid — always present when provider is selected
                    so layout doesn't collapse during loading (prevents scroll jump) */}
                <Show when={selectedProvider()}>
                    <div class="social-picker">
                        {/* Search + Sort toolbar */}
                        <div class="social-picker__toolbar">
                            <input
                                type="text"
                                class="social-picker__search"
                                placeholder="Search posts..."
                                value={searchInput()}
                                onInput={(e,) => setSearchInput(e.currentTarget.value,)}
                                onKeyDown={(e,) => {
                                    if (e.key === 'Enter') handleSearchSubmit();
                                }}
                                onBlur={handleSearchSubmit}
                            />
                            <select
                                class="social-picker__sort"
                                value={sort()}
                                onChange={(e,) => { setSort(e.currentTarget.value,); setPage(1,); }}
                            >
                                <For each={SORT_OPTIONS}>
                                    {(o,) => <option value={o.value}>{o.label}</option>}
                                </For>
                            </select>
                            <button
                                type="button"
                                class="btn btn--icon btn--small social-picker__dir"
                                onClick={() => { setSortDir(sortDir() === 'desc' ? 'asc' : 'desc',); setPage(1,); }}
                                title={sortDir() === 'desc' ? 'Newest first' : 'Oldest first'}
                            >
                                {sortDir() === 'desc' ? '↓' : '↑'}
                            </button>
                        </div>

                        {/* Post grid — min-height prevents layout collapse on loading */}
                        <div class="social-picker__grid-wrap" style={{ 'min-height': '130px', }}>
                            <Show
                                when={!result.loading}
                                fallback={
                                    <div class="social-picker__loading">Loading posts...</div>
                                }
                            >
                                <Show
                                    when={posts().length > 0}
                                    fallback={
                                        <div class="social-picker__empty">
                                            {search() ?
                                                `No posts matching "${search()}"` :
                                                'No posts found for this provider. Sync posts first from the Connections page.'}
                                        </div>
                                    }
                                >
                                    <div class="social-media-grid">
                                        <For each={posts()}>
                                            {(post: any,) => (
                                                <div
                                                    class={`social-media-grid__item ${
                                                        props.data.postId === (post.externalId || post.id) ?
                                                            'social-media-grid__item--selected' :
                                                            ''
                                                    }`}
                                                    onClick={() => selectPost(post,)}
                                                >
                                                    <Show when={post.thumbnailUrl || post.mediaUrl}>
                                                        <img
                                                            src={post.thumbnailUrl || post.mediaUrl}
                                                            alt=""
                                                            loading="lazy"
                                                        />
                                                    </Show>
                                                    <div class="social-media-grid__caption">
                                                        {(post.content || '').substring(0, 60,)}
                                                    </div>
                                                    <div class="social-media-grid__meta">
                                                        {post.likes ?? 0} likes
                                                        {' · '}
                                                        {post.comments ?? 0} comments
                                                        <Show when={post.publishedAt}>
                                                            {' · '}
                                                            {new Date(post.publishedAt,).toLocaleDateString()}
                                                        </Show>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>

                                    <Pagination
                                        page={meta().page}
                                        totalPages={meta().totalPages}
                                        total={meta().total}
                                        limit={meta().limit}
                                        onPageChange={setPage}
                                    />
                                </Show>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* Show comments toggle */}
                <div class="form-group">
                    <label class="checkbox-label">
                        <input
                            type="checkbox"
                            checked={props.data.showComments || false}
                            onChange={(e,) =>
                                props.onUpdate({ ...props.data, showComments: e.currentTarget.checked, },)}
                        />
                        Show comments
                    </label>
                </div>
            </Show>
        </div>
    );
};

export default SocialMediaBlock;

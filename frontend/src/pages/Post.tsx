import { Component, createResource, createSignal, Show, For } from 'solid-js';
import { useParams } from '@solidjs/router';
import { Title, Meta, Link } from '@solidjs/meta';
import { fetchPost } from '../services/api';
import ContentGate from '../components/ContentGate';
import { useAuth } from '../stores/auth';
import SocialEmbed from '../components/SocialEmbed';
import type { Post, ContentAccessLevel, SocialPlatform } from '@surge/shared';
import { JsonLd } from '../components/JsonLd';
import './Post.scss';

interface LockedContent {
  accessLevel: ContentAccessLevel;
  preview: {
    title?: string;
    description?: string;
    featuredImage?: string;
  };
}

/** Renders a single post content block on the public post page */
const PostContentBlock: Component<{ block: any }> = (props) => {
  const data = () => props.block.data || {};
  const type = () => props.block.type;

  return (
    <div class={`post-block post-block--${type()}`}>
      <Show when={type() === 'text'}>
        <div class="rich-text" innerHTML={data().content || ''} />
      </Show>

      <Show when={type() === 'image'}>
        <Show when={data().url}>
          <figure class="post-block__figure">
            <img
              src={data().url}
              alt={data().alt || ''}
              loading="lazy"
              style={{
                'max-width': data().maxWidth || '100%',
                'max-height': data().maxHeight || undefined,
              }}
            />
            <Show when={data().caption}>
              <figcaption>{data().caption}</figcaption>
            </Show>
          </figure>
        </Show>
      </Show>

      <Show when={type() === 'video'}>
        <Show when={data().url}>
          <div class="post-block__video">
            <video
              src={data().url}
              controls
              autoplay={data().autoplay}
              loop={data().loop}
              style={{
                'max-width': data().maxWidth || '100%',
                'max-height': data().maxHeight || undefined,
              }}
            />
          </div>
        </Show>
      </Show>

      <Show when={type() === 'social_media'}>
        <Show when={data().provider && (data().postId || data().postUrl)}>
          <SocialEmbed
            platform={data().provider as SocialPlatform}
            externalId={data().postId || ''}
            mediaUrl={data().postUrl}
            content={data().content}
          />
        </Show>
      </Show>

      <Show when={type() === 'document'}>
        <Show when={data().url}>
          <a
            href={data().url}
            target="_blank"
            rel="noopener noreferrer"
            class="post-block__document"
          >
            <span class="post-block__document-icon">&#128196;</span>
            <span>{data().displayName || data().fileName || 'Download document'}</span>
          </a>
        </Show>
      </Show>

      <Show when={type() === 'url_link'}>
        <Show when={data().url}>
          <a
            href={data().url}
            target="_blank"
            rel="noopener noreferrer"
            class="post-block__link-card"
          >
            <Show when={data().image}>
              <img src={data().image} alt="" class="post-block__link-image" loading="lazy" />
            </Show>
            <div class="post-block__link-body">
              <Show when={data().siteName}>
                <span class="post-block__link-site">{data().siteName}</span>
              </Show>
              <span class="post-block__link-title">{data().title || data().url}</span>
              <Show when={data().description}>
                <span class="post-block__link-desc">{data().description}</span>
              </Show>
            </div>
          </a>
        </Show>
      </Show>
    </div>
  );
};

const PostPage: Component = () => {
  const params = useParams();
  const auth = useAuth();
  const canonicalUrl = () => `${window.location.origin}/posts/${params.slug}`;
  const [lockedContent, setLockedContent] = createSignal<LockedContent | null>(null);

  const isPreviewMode = () => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('preview') === 'admin';
  };

  const [post] = createResource(
    () => params.slug,
    async (slug) => {
      setLockedContent(null);
      const preview = (isPreviewMode() && auth.user?.role === 'admin') ? 'admin' : undefined;
      const response = await fetchPost(slug, preview);
      if (!response.success) {
        const raw = response as any;
        if (raw.locked) {
          setLockedContent({
            accessLevel: raw.accessLevel,
            preview: raw.preview || {},
          });
          return null;
        }
        return null;
      }
      return response.data as Post;
    }
  );

  return (
    <div class="post-page container">
      <Show when={lockedContent()}>
        {(locked) => (
          <ContentGate
            accessLevel={locked().accessLevel}
            preview={locked().preview}
          />
        )}
      </Show>
      <Show when={!lockedContent()}>
        <Show when={post()} fallback={<div>Loading...</div>}>
          {(postData) => (
            <>
              <Title>{postData().title} - Surge Media</Title>
              <Meta name="description" content={postData().excerpt || ''} />
              <Link rel="canonical" href={canonicalUrl()} />
              <Meta property="og:title" content={postData().title} />
              <Meta property="og:description" content={postData().excerpt || ''} />
              <Meta property="og:type" content="article" />
              <Meta property="og:url" content={canonicalUrl()} />
              {postData().featuredImage && <Meta property="og:image" content={postData().featuredImage!} />}
              {postData().publishedAt && <Meta property="article:published_time" content={new Date(postData().publishedAt!).toISOString()} />}
              <Meta property="article:author" content={postData().author} />
              <Meta name="twitter:card" content="summary_large_image" />
              <Meta name="twitter:title" content={postData().title} />
              <Meta name="twitter:description" content={postData().excerpt || ''} />
              {postData().featuredImage && <Meta name="twitter:image" content={postData().featuredImage!} />}
              <JsonLd data={{
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                "headline": postData().title,
                "description": postData().excerpt || '',
                "url": canonicalUrl(),
                "datePublished": postData().publishedAt ? new Date(postData().publishedAt!).toISOString() : undefined,
                "dateModified": postData().updatedAt ? new Date(postData().updatedAt).toISOString() : undefined,
                "author": {
                  "@type": "Person",
                  "name": postData().author
                },
                "publisher": {
                  "@type": "NewsMediaOrganization",
                  "name": "Surge Media",
                  "url": "https://surgemedia.us"
                },
                ...(postData().featuredImage ? { "image": postData().featuredImage } : {})
              }} />

              <article class="post-page__article">
                <header class="post-page__header">
                  <h1 class="post-page__title">{postData().title}</h1>
                  <div class="post-page__meta">
                    <span>By {postData().author}</span>
                    <Show when={postData().publishedAt}>
                      <span>{new Date(postData().publishedAt!).toLocaleDateString()}</span>
                    </Show>
                  </div>
                </header>

                <Show when={postData().featuredImage}>
                  <img src={postData().featuredImage} alt={postData().title} class="post-page__image" />
                </Show>

                {/* Render content blocks if present */}
                <Show when={(postData() as any).contentBlocks?.length}>
                  <div class="post-page__blocks">
                    <For each={(postData() as any).contentBlocks}>
                      {(block: any) => <PostContentBlock block={block} />}
                    </For>
                  </div>
                </Show>

                {/* Fallback to legacy content field if no blocks */}
                <Show when={!(postData() as any).contentBlocks?.length && postData().content}>
                  <div class="rich-text" innerHTML={postData().content} />
                </Show>
              </article>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default PostPage;

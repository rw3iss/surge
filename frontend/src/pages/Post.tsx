import { Component, createResource, Show } from 'solid-js';
import { useParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { fetchPost } from '../services/api';
import type { Post } from '@surge/shared';
import './Post.scss';

const PostPage: Component = () => {
  const params = useParams();

  const [post] = createResource(
    () => params.slug,
    async (slug) => {
      const response = await fetchPost(slug);
      return response.success ? response.data as Post : null;
    }
  );

  return (
    <div class="post-page container">
      <Show when={post()} fallback={<div>Loading...</div>}>
        {(postData) => (
          <>
            <Title>{postData().title} - Surge Media</Title>
            <Meta name="description" content={postData().excerpt || ''} />

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

              <div class="rich-text" innerHTML={postData().content} />
            </article>
          </>
        )}
      </Show>
    </div>
  );
};

export default PostPage;

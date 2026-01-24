import { Component, createResource, For, Show } from 'solid-js';
import { A, useSearchParams } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { fetchPosts } from '../services/api';
import type { Post } from '@surge/shared';

const PostsPage: Component = () => {
  const [searchParams] = useSearchParams();

  const [posts] = createResource(
    () => ({ page: searchParams.page || '1', tag: searchParams.tag, category: searchParams.category }),
    async (params) => {
      const response = await fetchPosts({
        page: parseInt(params.page, 10),
        tag: params.tag,
        category: params.category,
      });
      return response.success ? response : null;
    }
  );

  return (
    <div class="posts-page container">
      <Title>Posts - Surge Media</Title>
      <h1>Latest Posts</h1>

      <Show when={posts()?.data} fallback={<div>Loading...</div>}>
        <div class="posts-grid">
          <For each={posts()?.data as Post[]}>
            {(post) => (
              <A href={`/posts/${post.slug}`} class="post-card">
                <Show when={post.featuredImage}>
                  <img src={post.featuredImage} alt={post.title} />
                </Show>
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
              </A>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default PostsPage;

import { Component, createResource, For, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { fetchPage } from '../services/api';
import { BlockRenderer } from '../components/BlockRenderer';
import { useAuth } from '../stores/auth';
import type { Page } from '@surge/shared';

const DynamicPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const auth = useAuth();

  const [page] = createResource(
    () => params.slug,
    async (slug) => {
      const response = await fetchPage(slug);
      if (!response.success) {
        if (response.error?.code === 'UNAUTHORIZED') {
          navigate(`/login?return=/${slug}`);
          return null;
        }
        return null;
      }
      return response.data as Page;
    }
  );

  return (
    <div class="dynamic-page">
      <Show when={page()} fallback={
        <Show when={page.loading} fallback={<div>Page not found</div>}>
          <div>Loading...</div>
        </Show>
      }>
        {(pageData) => (
          <>
            <Title>{pageData().metaTitle || pageData().title} - Surge Media</Title>
            <Meta name="description" content={pageData().metaDescription || pageData().description || ''} />

            <For each={pageData().blocks}>
              {(block) => (
                <Show when={block.isVisible}>
                  <BlockRenderer block={block} />
                </Show>
              )}
            </For>
          </>
        )}
      </Show>
    </div>
  );
};

export default DynamicPage;

import { Component, createResource, Show } from 'solid-js';
import { useParams } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { fetchCampaign } from '../services/api';
import type { Campaign } from '@surge/shared';

const CampaignPage: Component = () => {
  const params = useParams();
  const [campaign] = createResource(() => params.slug, async (slug) => {
    const response = await fetchCampaign(slug);
    return response.success ? response.data as Campaign : null;
  });

  return (
    <div class="campaign-page container">
      <Show when={campaign()} fallback={<div>Loading...</div>}>
        {(c) => (
          <>
            <Title>{c().title} - Surge Media</Title>
            <h1>{c().title}</h1>
            <div innerHTML={c().description} />
            <div class="campaign-progress">
              <div style={{ width: `${Math.min((c().currentAmountCents / c().goalAmountCents) * 100, 100)}%` }} />
            </div>
            <p>${(c().currentAmountCents / 100).toLocaleString()} raised of ${(c().goalAmountCents / 100).toLocaleString()}</p>
          </>
        )}
      </Show>
    </div>
  );
};

export default CampaignPage;

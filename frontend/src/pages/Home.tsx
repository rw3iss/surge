import { Component, createResource, For, Show, Suspense } from 'solid-js';
import { A } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { fetchPage, fetchHomepageSocialPosts, fetchCampaigns } from '../services/api';
import { BlockRenderer } from '../components/BlockRenderer';
import type { Page, SocialPost, Campaign } from '@surge/shared';
import './Home.scss';

const Home: Component = () => {
  const [page] = createResource(async () => {
    const response = await fetchPage('home');
    return response.success ? response.data as Page : null;
  });

  const [socialPosts] = createResource(async () => {
    const response = await fetchHomepageSocialPosts();
    return response.success ? response.data as SocialPost[] : [];
  });

  const [campaigns] = createResource(async () => {
    const response = await fetchCampaigns(false);
    return response.success ? response.data as Campaign[] : [];
  });

  return (
    <div class="home">
      <Title>Surge Media - Independent Journalism</Title>
      <Meta name="description" content="Surge Media - Independent journalism for the people" />

      <Show when={page()} fallback={<div class="home__loading">Loading...</div>}>
        {(pageData) => (
          <>
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

      {/* Social Media Section */}
      <Show when={socialPosts()?.length}>
        <section class="home__social">
          <div class="container">
            <h2 class="home__section-title">Follow Our Journey</h2>
            <div class="home__social-grid">
              <For each={socialPosts()}>
                {(post) => (
                  <a
                    href={post.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class={`home__social-card home__social-card--${post.platform}`}
                  >
                    <Show when={post.thumbnailUrl}>
                      <img
                        src={post.thumbnailUrl}
                        alt=""
                        class="home__social-thumbnail"
                        loading="lazy"
                      />
                    </Show>
                    <div class="home__social-content">
                      <span class="home__social-platform">{post.platform}</span>
                      <p class="home__social-text">{post.content?.substring(0, 100)}...</p>
                    </div>
                  </a>
                )}
              </For>
            </div>
          </div>
        </section>
      </Show>

      {/* Active Campaigns Section */}
      <Show when={campaigns()?.length}>
        <section class="home__campaigns">
          <div class="container">
            <h2 class="home__section-title">Support Our Work</h2>
            <div class="home__campaigns-grid">
              <For each={campaigns()?.slice(0, 3)}>
                {(campaign) => (
                  <A href={`/campaigns/${campaign.slug}`} class="home__campaign-card">
                    <Show when={campaign.featuredImage}>
                      <img
                        src={campaign.featuredImage}
                        alt={campaign.title}
                        class="home__campaign-image"
                        loading="lazy"
                      />
                    </Show>
                    <div class="home__campaign-content">
                      <h3 class="home__campaign-title">{campaign.title}</h3>
                      <p class="home__campaign-desc">{campaign.shortDescription}</p>
                      <div class="home__campaign-progress">
                        <div
                          class="home__campaign-progress-bar"
                          style={{
                            width: `${Math.min((campaign.currentAmountCents / campaign.goalAmountCents) * 100, 100)}%`
                          }}
                        />
                      </div>
                      <div class="home__campaign-stats">
                        <span>${(campaign.currentAmountCents / 100).toLocaleString()} raised</span>
                        <span>of ${(campaign.goalAmountCents / 100).toLocaleString()}</span>
                      </div>
                    </div>
                  </A>
                )}
              </For>
            </div>
            <div class="home__campaigns-cta">
              <A href="/donate" class="home__btn">View All Campaigns</A>
            </div>
          </div>
        </section>
      </Show>
    </div>
  );
};

export default Home;

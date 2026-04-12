import type { Page, } from '@surge/shared';
import { Component, createResource, For, Show, } from 'solid-js';
import { BlockRenderer, } from '../components/BlockRenderer';
import SeoHead from '../components/SeoHead';
import { fetchPage, } from '../services/api';
import { siteDescription, siteLogo, siteName, } from '../stores/siteSettings';
import { buildOrganization, } from '../utils/schema';
import './Home.scss';

const Home: Component = () => {
    const canonicalUrl = window.location.origin;
    const [page,] = createResource(async () => {
        const response = await fetchPage('home',);
        return response.success ? response.data as Page : null;
    },);

    return (
        <div class="home">
            <SeoHead
                title="Home"
                description={siteDescription()}
                canonical={canonicalUrl}
                type="website"
                image={siteLogo() || `${canonicalUrl}/icons/icon-512x512.png`}
                aeoSummary={`${siteName()} — ${siteDescription()}. Independent journalism, investigative reporting, and community stories.`}
                aeoEntityType="NewsMediaOrganization"
                jsonLd={buildOrganization({
                    name: siteName(),
                    url: canonicalUrl,
                    logo: siteLogo() || `${canonicalUrl}/icons/icon-512x512.png`,
                },)}
            />

            <Show when={page()} fallback={<div class="home__loading">Loading...</div>}>
                {(pageData,) => (
                    <>
                        <For each={pageData().blocks}>
                            {(block,) => (
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

export default Home;

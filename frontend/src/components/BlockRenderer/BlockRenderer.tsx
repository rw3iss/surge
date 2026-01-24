import { Component, Show, Switch, Match, createResource } from 'solid-js';
import type { Block, Post, Form, Campaign } from '@surge/shared';
import { api } from '../../services/api';
import './BlockRenderer.scss';

interface BlockRendererProps {
  block: Block;
}

export const BlockRenderer: Component<BlockRendererProps> = (props) => {
  return (
    <div
      class={`block block--${props.block.type}`}
      style={{
        'background-color': props.block.settings.backgroundColor as string,
        color: props.block.settings.textColor as string,
        padding: props.block.settings.padding as string,
      }}
    >
      <div class={`block__inner block__inner--${props.block.settings.layout || 'contained'}`}>
        <Switch>
          <Match when={props.block.type === 'hero'}>
            <HeroBlock block={props.block} />
          </Match>
          <Match when={props.block.type === 'rich_text'}>
            <RichTextBlock block={props.block} />
          </Match>
          <Match when={props.block.type === 'image'}>
            <ImageBlock block={props.block} />
          </Match>
          <Match when={props.block.type === 'video'}>
            <VideoBlock block={props.block} />
          </Match>
          <Match when={props.block.type === 'post'}>
            <PostBlock block={props.block} />
          </Match>
          <Match when={props.block.type === 'form'}>
            <FormBlock block={props.block} />
          </Match>
          <Match when={props.block.type === 'campaign'}>
            <CampaignBlock block={props.block} />
          </Match>
          <Match when={props.block.type === 'html'}>
            <HTMLBlock block={props.block} />
          </Match>
        </Switch>
      </div>
    </div>
  );
};

const HeroBlock: Component<{ block: Block }> = (props) => (
  <section class="hero-block">
    <Show when={props.block.title}>
      <h1 class="hero-block__title">{props.block.title}</h1>
    </Show>
    <Show when={props.block.content}>
      <p class="hero-block__content">{props.block.content}</p>
    </Show>
  </section>
);

const RichTextBlock: Component<{ block: Block }> = (props) => (
  <div class="rich-text-block">
    <Show when={props.block.title}>
      <h2 class="rich-text-block__title">{props.block.title}</h2>
    </Show>
    <div class="rich-text" innerHTML={props.block.content || ''} />
  </div>
);

const ImageBlock: Component<{ block: Block }> = (props) => {
  const mediaIds = () => props.block.settings.mediaIds as string[] || [];

  return (
    <div class="image-block">
      <Show when={props.block.title}>
        <h2 class="image-block__title">{props.block.title}</h2>
      </Show>
      <Show when={mediaIds().length > 0}>
        <div class="image-block__images">
          {/* Would load images from media IDs */}
        </div>
      </Show>
    </div>
  );
};

const VideoBlock: Component<{ block: Block }> = (props) => (
  <div class="video-block">
    <Show when={props.block.title}>
      <h2 class="video-block__title">{props.block.title}</h2>
    </Show>
    <Show when={props.block.content}>
      <div class="video-block__wrapper">
        <iframe
          src={props.block.content}
          frameBorder="0"
          allowFullScreen
          class="video-block__iframe"
        />
      </div>
    </Show>
  </div>
);

const PostBlock: Component<{ block: Block }> = (props) => {
  const postId = () => props.block.settings.postId as string;

  const [post] = createResource(postId, async (id) => {
    if (!id) return null;
    const response = await api.get<Post>(`/posts/${id}`);
    return response.success ? response.data : null;
  });

  return (
    <Show when={post()}>
      <article class="post-block">
        <Show when={post()!.featuredImage}>
          <img src={post()!.featuredImage} alt={post()!.title} class="post-block__image" />
        </Show>
        <h2 class="post-block__title">{post()!.title}</h2>
        <div class="rich-text" innerHTML={post()!.content} />
      </article>
    </Show>
  );
};

const FormBlock: Component<{ block: Block }> = (props) => {
  const formId = () => props.block.settings.formId as string;

  return (
    <Show when={formId()}>
      <div class="form-block">
        {/* Form component would be rendered here */}
        <p>Form: {formId()}</p>
      </div>
    </Show>
  );
};

const CampaignBlock: Component<{ block: Block }> = (props) => {
  const campaignId = () => props.block.settings.campaignId as string;

  const [campaign] = createResource(campaignId, async (id) => {
    if (!id) return null;
    const response = await api.get<Campaign>(`/campaigns/${id}`);
    return response.success ? response.data : null;
  });

  return (
    <Show when={campaign()}>
      <div class="campaign-block">
        <h2 class="campaign-block__title">{campaign()!.title}</h2>
        <p class="campaign-block__desc">{campaign()!.shortDescription}</p>
        <div class="campaign-block__progress">
          <div
            class="campaign-block__progress-bar"
            style={{
              width: `${Math.min((campaign()!.currentAmountCents / campaign()!.goalAmountCents) * 100, 100)}%`
            }}
          />
        </div>
        <p class="campaign-block__stats">
          ${(campaign()!.currentAmountCents / 100).toLocaleString()} of ${(campaign()!.goalAmountCents / 100).toLocaleString()}
        </p>
      </div>
    </Show>
  );
};

const HTMLBlock: Component<{ block: Block }> = (props) => (
  <div class="html-block" innerHTML={props.block.content || ''} />
);

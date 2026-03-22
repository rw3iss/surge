import { Component, Switch, Match, Show } from 'solid-js';
import TextBlock from './blocks/TextBlock';
import SocialMediaBlock from './blocks/SocialMediaBlock';
import ImageBlock from './blocks/ImageBlock';
import VideoBlock from './blocks/VideoBlock';
import DocumentBlock from './blocks/DocumentBlock';
import UrlLinkBlock from './blocks/UrlLinkBlock';

export type BlockType =
  // Post block types
  | 'text' | 'social_media' | 'image' | 'video' | 'document' | 'url_link'
  // Page block types
  | 'rich_text' | 'hero' | 'html' | 'campaign' | 'form' | 'post' | 'social_feed' | 'gallery';

export interface BlockData {
  id: string;
  type: BlockType;
  sort_order: number;
  data: Record<string, any>;
}

interface ContentBlockProps {
  block: BlockData;
  index: number;
  total: number;
  isEditing: boolean;
  isDragging: boolean;
  onToggleEdit: (id: string) => void;
  onCancel: (id: string) => void;
  onUpdate: (id: string, data: Record<string, any>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDragStart: (e: PointerEvent, id: string) => void;
}

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text: 'Text',
  social_media: 'Social Media',
  image: 'Image',
  video: 'Video',
  document: 'Document',
  url_link: 'URL Link',
  rich_text: 'Rich Text',
  hero: 'Hero Banner',
  html: 'Custom HTML',
  campaign: 'Campaign',
  form: 'Form',
  post: 'Post Embed',
  social_feed: 'Social Feed',
  gallery: 'Gallery',
};

/** Simple key-value editor for reference-type blocks (campaign, form, post, social_feed, gallery) */
const ReferenceBlock: Component<{ data: Record<string, any>; mode: string; onUpdate: (data: Record<string, any>) => void; label: string; idField: string }> = (props) => {
  return (
    <div class="block-reference">
      <Show when={props.mode === 'edit'} fallback={
        <div class="block-reference__preview">
          <Show when={props.data[props.idField]} fallback={<span class="block-text__empty">No {props.label.toLowerCase()} selected. Click Edit to configure.</span>}>
            <span>{props.label} ID: <strong>{props.data[props.idField]}</strong></span>
          </Show>
          <Show when={props.data.title}>
            <span> - {props.data.title}</span>
          </Show>
        </div>
      }>
        <div class="form-group">
          <label>{props.label} ID or Slug</label>
          <input
            type="text"
            value={props.data[props.idField] || ''}
            onInput={(e) => props.onUpdate({ ...props.data, [props.idField]: e.currentTarget.value })}
            placeholder={`Enter ${props.label.toLowerCase()} ID or slug...`}
          />
        </div>
        <div class="form-group">
          <label>Title (optional)</label>
          <input
            type="text"
            value={props.data.title || ''}
            onInput={(e) => props.onUpdate({ ...props.data, title: e.currentTarget.value })}
            placeholder="Display title..."
          />
        </div>
      </Show>
    </div>
  );
};

/** Hero block: title + subtitle + background image, uses TextBlock for content editing */
const HeroBlock: Component<{ data: Record<string, any>; mode: string; onUpdate: (data: Record<string, any>) => void }> = (props) => {
  return (
    <div class="block-hero">
      <Show when={props.mode === 'edit'} fallback={
        <div class="block-hero__preview">
          <Show when={props.data.title || props.data.content} fallback={<span class="block-text__empty">No hero content yet. Click Edit to configure.</span>}>
            <Show when={props.data.title}><h3>{props.data.title}</h3></Show>
            <Show when={props.data.subtitle}><p>{props.data.subtitle}</p></Show>
            <Show when={props.data.content}><div innerHTML={props.data.content} /></Show>
            <Show when={props.data.backgroundImage}>
              <div class="block-hero__bg-preview" style={{ "font-size": "0.85em", color: "#666" }}>Background: {props.data.backgroundImage}</div>
            </Show>
          </Show>
        </div>
      }>
        <div class="form-group">
          <label>Hero Title</label>
          <input
            type="text"
            value={props.data.title || ''}
            onInput={(e) => props.onUpdate({ ...props.data, title: e.currentTarget.value })}
            placeholder="Hero title..."
          />
        </div>
        <div class="form-group">
          <label>Subtitle</label>
          <input
            type="text"
            value={props.data.subtitle || ''}
            onInput={(e) => props.onUpdate({ ...props.data, subtitle: e.currentTarget.value })}
            placeholder="Hero subtitle..."
          />
        </div>
        <div class="form-group">
          <label>Background Image URL</label>
          <input
            type="text"
            value={props.data.backgroundImage || ''}
            onInput={(e) => props.onUpdate({ ...props.data, backgroundImage: e.currentTarget.value })}
            placeholder="https://..."
          />
        </div>
        <TextBlock data={props.data} mode={props.mode} onUpdate={props.onUpdate} />
      </Show>
    </div>
  );
};

/** HTML block: raw HTML editing via textarea */
const HtmlBlock: Component<{ data: Record<string, any>; mode: string; onUpdate: (data: Record<string, any>) => void }> = (props) => {
  return (
    <div class="block-html">
      <Show when={props.mode === 'edit'} fallback={
        <div class="block-html__preview">
          <Show when={props.data.content} fallback={<span class="block-text__empty">No HTML content yet. Click Edit to add.</span>}>
            <div innerHTML={props.data.content} />
          </Show>
        </div>
      }>
        <div class="form-group">
          <label>Custom HTML</label>
          <textarea
            rows={10}
            value={props.data.content || ''}
            onInput={(e) => props.onUpdate({ ...props.data, content: e.currentTarget.value })}
            placeholder="Enter raw HTML..."
            style={{ "font-family": "monospace", "font-size": "0.9em" }}
          />
        </div>
      </Show>
    </div>
  );
};

const ContentBlock: Component<ContentBlockProps> = (props) => {
  const mode = () => props.isEditing ? 'edit' : 'view';

  const handleUpdate = (data: Record<string, any>) => {
    props.onUpdate(props.block.id, data);
  };

  return (
    <div
      class={`content-block ${props.isEditing ? 'content-block--editing' : ''} ${props.isDragging ? 'content-block--dragging' : ''}`}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.block-toolbar__drag')) {
          props.onDragStart(e, props.block.id);
        }
      }}
    >
      <div class="block-toolbar">
        <span class="block-toolbar__drag" title="Drag to reorder">&#9776;</span>
        <span class="block-toolbar__type">{BLOCK_TYPE_LABELS[props.block.type] || props.block.type}</span>
        <div class="block-toolbar__actions">
          <button class="btn btn--small btn--icon" onClick={() => props.onMoveUp(props.block.id)} disabled={props.index === 0} title="Move up">&#9650;</button>
          <button class="btn btn--small btn--icon" onClick={() => props.onMoveDown(props.block.id)} disabled={props.index === props.total - 1} title="Move down">&#9660;</button>
          <button class="btn btn--small btn--secondary" onClick={() => props.onToggleEdit(props.block.id)}>
            {props.isEditing ? 'Save' : 'Edit'}
          </button>
          <Show when={props.isEditing}>
            <button class="btn btn--small btn--ghost" onClick={() => props.onCancel(props.block.id)}>
              Cancel
            </button>
          </Show>
          <button class="btn btn--small btn--danger" onClick={() => props.onRemove(props.block.id)} title="Remove block">&#10005;</button>
        </div>
      </div>
      <div class="content-block__body">
        <Switch>
          {/* Post block types */}
          <Match when={props.block.type === 'text'}>
            <TextBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} />
          </Match>
          <Match when={props.block.type === 'social_media'}>
            <SocialMediaBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} />
          </Match>
          <Match when={props.block.type === 'image'}>
            <ImageBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} />
          </Match>
          <Match when={props.block.type === 'video'}>
            <VideoBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} />
          </Match>
          <Match when={props.block.type === 'document'}>
            <DocumentBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} />
          </Match>
          <Match when={props.block.type === 'url_link'}>
            <UrlLinkBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} />
          </Match>
          {/* Page block types */}
          <Match when={props.block.type === 'rich_text'}>
            <TextBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} />
          </Match>
          <Match when={props.block.type === 'hero'}>
            <HeroBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} />
          </Match>
          <Match when={props.block.type === 'html'}>
            <HtmlBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} />
          </Match>
          <Match when={props.block.type === 'campaign'}>
            <ReferenceBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} label="Campaign" idField="campaignId" />
          </Match>
          <Match when={props.block.type === 'form'}>
            <ReferenceBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} label="Form" idField="formId" />
          </Match>
          <Match when={props.block.type === 'post'}>
            <ReferenceBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} label="Post" idField="postId" />
          </Match>
          <Match when={props.block.type === 'social_feed'}>
            <ReferenceBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} label="Social Feed" idField="platform" />
          </Match>
          <Match when={props.block.type === 'gallery'}>
            <ReferenceBlock data={props.block.data} mode={mode()} onUpdate={handleUpdate} label="Gallery" idField="galleryId" />
          </Match>
        </Switch>
      </div>
    </div>
  );
};

export default ContentBlock;

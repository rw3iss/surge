import { Component, Switch, Match, Show } from 'solid-js';
import TextBlock from './blocks/TextBlock';
import SocialMediaBlock from './blocks/SocialMediaBlock';
import ImageBlock from './blocks/ImageBlock';
import VideoBlock from './blocks/VideoBlock';
import DocumentBlock from './blocks/DocumentBlock';
import UrlLinkBlock from './blocks/UrlLinkBlock';

export type BlockType = 'text' | 'social_media' | 'image' | 'video' | 'document' | 'url_link';

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
        <span class="block-toolbar__type">{BLOCK_TYPE_LABELS[props.block.type]}</span>
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
        </Switch>
      </div>
    </div>
  );
};

export default ContentBlock;

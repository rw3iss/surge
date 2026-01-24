import { Component, Show } from 'solid-js';

interface TextBlockProps {
  data: Record<string, any>;
  mode: 'view' | 'edit';
  onUpdate: (data: Record<string, any>) => void;
}

const TextBlock: Component<TextBlockProps> = (props) => {
  return (
    <div class="block-text">
      <Show when={props.mode === 'edit'} fallback={
        <div class="block-text__preview">
          <Show when={props.data.content} fallback={<span class="block-text__empty">No content yet. Click Edit to add text.</span>}>
            <div innerHTML={props.data.content?.replace(/\n/g, '<br/>')} />
          </Show>
        </div>
      }>
        <div class="form-group">
          <label>Content</label>
          <textarea
            rows={8}
            value={props.data.content || ''}
            onInput={(e) => props.onUpdate({ ...props.data, content: e.currentTarget.value })}
            placeholder="Enter text content..."
          />
        </div>
      </Show>
    </div>
  );
};

export default TextBlock;

import { Component, createSignal, createResource, createEffect, For, Index, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { api } from '../../services/api';
import ContentBlock, { BlockData, BlockType } from '../../components/admin/ContentBlock';

const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'social_media', label: 'Social Media' },
  { type: 'image', label: 'Image' },
  { type: 'video', label: 'Video' },
  { type: 'document', label: 'Document' },
  { type: 'url_link', label: 'URL Link' },
];

let blockIdCounter = 0;
const generateBlockId = () => `block-${Date.now()}-${++blockIdCounter}`;

const AdminPostEditor: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = () => !params.id || params.id === 'new';

  const [post] = createResource(() => isNew() ? null : params.id, async (id) => {
    if (!id) return null;
    const response = await api.get(`/posts/${id}`);
    return response.success ? (response as any).data : null;
  });

  const [title, setTitle] = createSignal('');
  const [slug, setSlug] = createSignal('');
  const [excerpt, setExcerpt] = createSignal('');
  const [status, setStatus] = createSignal('draft');
  const [tags, setTags] = createSignal('');
  const [blocks, setBlocks] = createSignal<BlockData[]>([]);
  const [editingBlocks, setEditingBlocks] = createSignal<Set<string>>(new Set());
  const [originalBlockData, setOriginalBlockData] = createSignal<Map<string, Record<string, any>>>(new Map());
  const [error, setError] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [showAddDropdown, setShowAddDropdown] = createSignal(false);
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [ghostStyle, setGhostStyle] = createSignal<{ top: number; left: number; width: number } | null>(null);
  const [ghostContent, setGhostContent] = createSignal<string>('');

  createEffect(() => {
    const p = post();
    if (p) {
      setTitle(p.title || '');
      setSlug(p.slug || '');
      setExcerpt(p.excerpt || '');
      setStatus(p.status || 'draft');
      setTags((p.tags || []).join(', '));
      if (p.contentBlocks?.length) {
        setBlocks(p.contentBlocks.map((b: any) => ({
          id: b.id || generateBlockId(),
          type: b.type,
          sort_order: b.sortOrder ?? b.sort_order,
          data: b.data || {},
        })));
      }
    }
  });

  const toggleEditBlock = (id: string) => {
    const isCurrentlyEditing = editingBlocks().has(id);
    if (!isCurrentlyEditing) {
      // Entering edit mode: store original data
      const block = blocks().find(b => b.id === id);
      if (block) {
        setOriginalBlockData(prev => {
          const next = new Map(prev);
          next.set(id, { ...block.data });
          return next;
        });
      }
    } else {
      // Saving: clear stored original data
      setOriginalBlockData(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
    setEditingBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const cancelEditBlock = (id: string) => {
    // Restore original data
    const original = originalBlockData().get(id);
    if (original) {
      setBlocks(blocks().map(b => b.id === id ? { ...b, data: original } : b));
    }
    // Exit edit mode and clear stored data
    setOriginalBlockData(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setEditingBlocks(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const addBlock = (type: BlockType) => {
    const currentBlocks = blocks();
    const newBlock: BlockData = {
      id: generateBlockId(),
      type,
      sort_order: currentBlocks.length,
      data: {},
    };
    setBlocks([...currentBlocks, newBlock]);
    // Auto-enter edit mode for new blocks
    setEditingBlocks(prev => {
      const next = new Set(prev);
      next.add(newBlock.id);
      return next;
    });
    setShowAddDropdown(false);
  };

  const updateBlock = (id: string, data: Record<string, any>) => {
    setBlocks(blocks().map(b => b.id === id ? { ...b, data } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks().filter(b => b.id !== id).map((b, i) => ({ ...b, sort_order: i })));
  };

  const moveBlockUp = (id: string) => {
    const idx = blocks().findIndex(b => b.id === id);
    if (idx <= 0) return;
    const arr = [...blocks()];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setBlocks(arr.map((b, i) => ({ ...b, sort_order: i })));
  };

  const moveBlockDown = (id: string) => {
    const idx = blocks().findIndex(b => b.id === id);
    if (idx < 0 || idx >= blocks().length - 1) return;
    const arr = [...blocks()];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setBlocks(arr.map((b, i) => ({ ...b, sort_order: i })));
  };

  const handleDragStart = (e: PointerEvent, id: string) => {
    const blockEl = (e.target as HTMLElement).closest('.content-block') as HTMLElement;
    if (!blockEl) return;

    const rect = blockEl.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const offsetX = e.clientX - rect.left;

    // Capture ghost info
    const typeLabel = blockEl.querySelector('.block-toolbar__type')?.textContent || '';
    setGhostContent(typeLabel);
    setGhostStyle({ top: rect.top, left: rect.left, width: rect.width });
    setDraggingId(id);

    // Get references to all block elements for position calculation
    const listEl = blockEl.parentElement;
    let currentIndex = blocks().findIndex(b => b.id === id);

    const handleMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault();

      // Update ghost position
      setGhostStyle(prev => prev ? {
        ...prev,
        top: moveEvt.clientY - offsetY,
        left: moveEvt.clientX - offsetX,
      } : null);

      // Calculate new index based on cursor position relative to block midpoints
      if (!listEl) return;
      const blockEls = Array.from(listEl.querySelectorAll('.content-block')) as HTMLElement[];
      const cursorY = moveEvt.clientY;

      let newIndex = currentIndex;
      for (let i = 0; i < blockEls.length; i++) {
        const elRect = blockEls[i].getBoundingClientRect();
        const midY = elRect.top + elRect.height / 2;
        if (cursorY < midY) {
          newIndex = i;
          break;
        }
        newIndex = i + 1;
      }
      newIndex = Math.max(0, Math.min(blocks().length - 1, newIndex > currentIndex ? newIndex - 1 : newIndex));

      if (newIndex !== currentIndex) {
        const arr = [...blocks()];
        const [item] = arr.splice(currentIndex, 1);
        arr.splice(newIndex, 0, item);
        setBlocks(arr.map((b, i) => ({ ...b, sort_order: i })));
        currentIndex = newIndex;
      }
    };

    const handleUp = () => {
      setDraggingId(null);
      setGhostStyle(null);
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  const handleSave = async () => {
    setError('');
    if (!title()) { setError('Title is required'); return; }
    if (!slug()) { setError('Slug is required'); return; }

    setSaving(true);

    const tagList = tags().split(',').map(t => t.trim()).filter(Boolean);
    const data = {
      title: title(),
      slug: slug(),
      excerpt: excerpt(),
      status: status(),
      tags: tagList,
      contentBlocks: blocks().map((b, i) => ({
        id: b.id.startsWith('block-') ? undefined : b.id,
        type: b.type,
        sort_order: i,
        data: b.data,
      })),
    };

    const response = isNew()
      ? await api.post('/posts', data)
      : await api.put(`/posts/${params.id}`, data);

    setSaving(false);

    if (response.success) {
      navigate('/admin/posts');
    } else {
      setError((response as any).error?.message || 'Failed to save post');
    }
  };

  return (
    <div>
      <Title>{isNew() ? 'New Post' : 'Edit Post'} - Admin - Surge Media</Title>
      <div class="admin-header">
        <h1>{isNew() ? 'New Post' : 'Edit Post'}</h1>
        <button class="btn btn--primary" onClick={handleSave} disabled={saving()}>
          {saving() ? 'Saving...' : 'Save Post'}
        </button>
      </div>
      <Show when={error()}>
        <div class="alert alert--error">{error()}</div>
      </Show>
      <div class="admin-form">
        <div class="form-section">
          <h2>Post Details</h2>
          <div class="form-group">
            <label>Title</label>
            <input type="text" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Post title" />
          </div>
          <div class="form-row">
            <div class="form-group form-group--grow">
              <label>Slug</label>
              <input type="text" value={slug()} onInput={(e) => setSlug(e.currentTarget.value)} placeholder="post-slug" />
              <span class="form-help">URL path: /posts/{slug() || 'post-slug'}</span>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select value={status()} onChange={(e) => setStatus(e.currentTarget.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Excerpt</label>
            <textarea rows={3} value={excerpt()} onInput={(e) => setExcerpt(e.currentTarget.value)} placeholder="Brief summary of the post..." />
          </div>
          <div class="form-group">
            <label>Tags</label>
            <input type="text" value={tags()} onInput={(e) => setTags(e.currentTarget.value)} placeholder="tag1, tag2, tag3" />
            <span class="form-help">Comma-separated list of tags</span>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header">
            <h2>Content Blocks</h2>
          </div>
          <div class={`content-blocks-list ${draggingId() ? 'content-blocks-list--dragging' : ''}`}>
            <Index each={blocks()} fallback={<div class="empty-state">No content blocks yet. Add one below.</div>}>
              {(block, index) => (
                <ContentBlock
                  block={block()}
                  index={index}
                  total={blocks().length}
                  isEditing={editingBlocks().has(block().id)}
                  isDragging={draggingId() === block().id}
                  onToggleEdit={toggleEditBlock}
                  onCancel={cancelEditBlock}
                  onUpdate={updateBlock}
                  onRemove={removeBlock}
                  onMoveUp={moveBlockUp}
                  onMoveDown={moveBlockDown}
                  onDragStart={handleDragStart}
                />
              )}
            </Index>
          </div>
          <Show when={ghostStyle()}>
            {(style) => (
              <div
                class="content-block-ghost"
                style={{
                  position: 'fixed',
                  top: `${style().top}px`,
                  left: `${style().left}px`,
                  width: `${style().width}px`,
                }}
              >
                <div class="content-block-ghost__inner">
                  <span class="content-block-ghost__icon">&#9776;</span>
                  <span class="content-block-ghost__label">{ghostContent()}</span>
                </div>
              </div>
            )}
          </Show>
          <div class="add-block-dropdown">
            <button class="btn btn--secondary" onClick={() => setShowAddDropdown(!showAddDropdown())}>
              + Add Block
            </button>
            <Show when={showAddDropdown()}>
              <div class="add-block-dropdown__menu">
                <For each={BLOCK_TYPES}>
                  {(bt) => (
                    <button class="add-block-dropdown__item" onClick={() => addBlock(bt.type)}>
                      {bt.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn--primary" onClick={handleSave} disabled={saving()}>
            {saving() ? 'Saving...' : 'Save Post'}
          </button>
          <button class="btn btn--secondary" onClick={() => navigate('/admin/posts')}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AdminPostEditor;

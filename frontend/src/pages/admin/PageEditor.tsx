import { Component, createSignal, createResource, createEffect, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { api } from '../../services/api';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import BlockEditor, { BlockData, BlockType, BlockTypeOption } from '../../components/admin/BlockEditor';

const PAGE_BLOCK_TYPES: BlockTypeOption[] = [
  { type: 'rich_text' as BlockType, label: 'Rich Text' },
  { type: 'image' as BlockType, label: 'Image' },
  { type: 'video' as BlockType, label: 'Video' },
  { type: 'hero' as BlockType, label: 'Hero Banner' },
  { type: 'html' as BlockType, label: 'Custom HTML' },
  { type: 'social_feed' as BlockType, label: 'Social Feed' },
  { type: 'campaign' as BlockType, label: 'Campaign' },
  { type: 'form' as BlockType, label: 'Form' },
  { type: 'post' as BlockType, label: 'Post Embed' },
  { type: 'gallery' as BlockType, label: 'Gallery' },
];

let blockIdCounter = 0;
const generateBlockId = () => `block-${Date.now()}-${++blockIdCounter}`;

/** Convert backend page block to BlockData format used by BlockEditor */
function pageBlockToBlockData(block: any): BlockData {
  return {
    id: block.id,
    type: block.type,
    sort_order: block.order ?? 0,
    data: {
      title: block.title || '',
      content: block.content || '',
      ...(block.settings || {}),
    },
  };
}

/** Convert BlockData back to page block API format */
function blockDataToPageBlock(block: BlockData, order: number) {
  const { title, content, ...settings } = block.data;
  return {
    type: block.type,
    title: title || undefined,
    content: content || undefined,
    settings: Object.keys(settings).length > 0 ? settings : {},
    order,
    isVisible: true,
  };
}

const AdminPageEditor: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = () => !params.id || params.id === 'new';
  const { markDirty, markClean } = useUnsavedChanges();

  const [page] = createResource(() => isNew() ? null : params.id, async (id) => {
    if (!id) return null;
    const response = await api.get(`/pages/${id}`);
    return response.success ? (response as any).data : null;
  });

  const [title, setTitle] = createSignal('');
  const [slug, setSlug] = createSignal('');
  const [status, setStatus] = createSignal('draft');
  const [accessLevel, setAccessLevel] = createSignal('public');
  const [blocks, setBlocks] = createSignal<BlockData[]>([]);
  const [originalBlockIds, setOriginalBlockIds] = createSignal<Set<string>>(new Set());
  const [error, setError] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    const p = page();
    if (p) {
      setTitle(p.title || '');
      setSlug(p.slug || '');
      setStatus(p.status || 'draft');
      setAccessLevel(p.accessLevel || 'public');
      if (p.blocks?.length) {
        const converted = p.blocks.map((b: any) => pageBlockToBlockData(b));
        setBlocks(converted);
        setOriginalBlockIds(new Set(p.blocks.map((b: any) => b.id)));
      }
    }
  });

  const syncBlocks = async (pageId: string) => {
    const currentBlocks = blocks();
    const origIds = originalBlockIds();

    // Determine which blocks are new, updated, or deleted
    const currentIds = new Set(currentBlocks.map(b => b.id));
    const deletedIds = [...origIds].filter(id => !currentIds.has(id));
    const newBlocks = currentBlocks.filter(b => !origIds.has(b.id));
    const existingBlocks = currentBlocks.filter(b => origIds.has(b.id));

    // Delete removed blocks
    for (const id of deletedIds) {
      await api.delete(`/pages/${pageId}/blocks/${id}`);
    }

    // Create new blocks
    for (let i = 0; i < newBlocks.length; i++) {
      const b = newBlocks[i];
      const order = currentBlocks.indexOf(b);
      await api.post(`/pages/${pageId}/blocks`, blockDataToPageBlock(b, order));
    }

    // Update existing blocks
    for (const b of existingBlocks) {
      const order = currentBlocks.indexOf(b);
      await api.put(`/pages/${pageId}/blocks/${b.id}`, blockDataToPageBlock(b, order));
    }

    // Reorder all blocks
    const blockIds = currentBlocks
      .filter(b => origIds.has(b.id))
      .map(b => b.id);
    if (blockIds.length > 1) {
      await api.put(`/pages/${pageId}/blocks/reorder`, { blockIds });
    }
  };

  const handleSave = async () => {
    setError('');
    if (!title()) { setError('Title is required'); return; }
    if (!slug()) { setError('Slug is required'); return; }

    setSaving(true);

    try {
      const data = {
        title: title(),
        slug: slug(),
        status: status(),
        accessLevel: accessLevel(),
      };

      let pageId = params.id;

      if (isNew()) {
        const response = await api.post('/pages', data);
        if (!response.success) {
          setError((response as any).error?.message || 'Failed to create page');
          setSaving(false);
          return;
        }
        pageId = (response as any).data.id;
      } else {
        const response = await api.put(`/pages/${params.id}`, data);
        if (!response.success) {
          setError((response as any).error?.message || 'Failed to save page');
          setSaving(false);
          return;
        }
      }

      // Sync blocks to backend
      if (pageId) {
        await syncBlocks(pageId);
      }

      markClean();
      navigate('/admin/pages');
    } catch (err: any) {
      setError(err.message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Title>{isNew() ? 'New Page' : 'Edit Page'} - Admin - Surge Media</Title>
      <div class="admin-header">
        <h1>{isNew() ? 'New Page' : 'Edit Page'}</h1>
        <div class="admin-header__actions">
          <Show when={!isNew() && page()}>
            <Show when={page()?.status === 'published'}>
              <a href={`/${page()?.slug}`} target="_blank" class="btn btn--secondary">View Page &nearr;</a>
            </Show>
            <Show when={page()?.status !== 'published'}>
              <a href={`/${page()?.slug}?preview=admin`} target="_blank" class="btn btn--ghost">Preview Draft &nearr;</a>
            </Show>
          </Show>
          <button class="btn btn--primary" onClick={handleSave} disabled={saving()}>
            {saving() ? 'Saving...' : 'Save Page'}
          </button>
        </div>
      </div>
      <Show when={error()}>
        <div class="alert alert--error">{error()}</div>
      </Show>
      <div class="admin-form">
        <div class="form-section">
          <h2>Page Details</h2>
          <div class="form-group">
            <label>Title</label>
            <input type="text" value={title()} onInput={(e) => { setTitle(e.currentTarget.value); markDirty(); }} placeholder="Page title" />
          </div>
          <div class="form-row">
            <div class="form-group form-group--grow">
              <label>Slug</label>
              <input type="text" value={slug()} onInput={(e) => { setSlug(e.currentTarget.value); markDirty(); }} placeholder="page-slug" />
              <span class="form-help">URL path for this page (e.g. "about" → /about)</span>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select value={status()} onChange={(e) => { setStatus(e.currentTarget.value); markDirty(); }}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="form-group">
              <label>Access Level</label>
              <select value={accessLevel()} onChange={(e) => { setAccessLevel(e.currentTarget.value); markDirty(); }}>
                <option value="public">Public</option>
                <option value="member">Members Only</option>
                <option value="patron">Patrons Only</option>
              </select>
              <span class="form-help">Who can view this page</span>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header">
            <h2>Page Content</h2>
          </div>
          <BlockEditor
            blocks={blocks()}
            onBlocksChange={(newBlocks) => { setBlocks(newBlocks); markDirty(); }}
            blockTypes={PAGE_BLOCK_TYPES}
          />
        </div>

        <div class="form-actions">
          <button class="btn btn--primary" onClick={handleSave} disabled={saving()}>
            {saving() ? 'Saving...' : 'Save Page'}
          </button>
          <button class="btn btn--secondary" onClick={() => navigate('/admin/pages')}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AdminPageEditor;

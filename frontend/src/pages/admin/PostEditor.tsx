import { Component, createSignal, createResource, createEffect, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { api } from '../../services/api';
import { BlockData } from '../../components/admin/ContentBlock';
import BlockEditor from '../../components/admin/BlockEditor';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

let blockIdCounter = 0;
const generateBlockId = () => `block-${Date.now()}-${++blockIdCounter}`;

const AdminPostEditor: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = () => !params.id || params.id === 'new';
  const { markDirty, markClean } = useUnsavedChanges();

  const [post] = createResource(() => isNew() ? null : params.id, async (id) => {
    if (!id) return null;
    const response = await api.get(`/posts/${id}`);
    return response.success ? (response as any).data : null;
  });

  const [title, setTitle] = createSignal('');
  const [slug, setSlug] = createSignal('');
  const [excerpt, setExcerpt] = createSignal('');
  const [status, setStatus] = createSignal('draft');
  const [accessLevel, setAccessLevel] = createSignal('public');
  const [tags, setTags] = createSignal('');
  const [blocks, setBlocks] = createSignal<BlockData[]>([]);
  const [error, setError] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    const p = post();
    if (p) {
      setTitle(p.title || '');
      setSlug(p.slug || '');
      setExcerpt(p.excerpt || '');
      setStatus(p.status || 'draft');
      setAccessLevel(p.accessLevel || 'public');
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
      accessLevel: accessLevel(),
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
      markClean();
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
        <div class="admin-header__actions">
          <Show when={!isNew() && post()}>
            <Show when={post()?.status === 'published'}>
              <a href={`/posts/${post()?.slug}`} target="_blank" class="btn btn--secondary">View Post &nearr;</a>
            </Show>
            <Show when={post()?.status !== 'published'}>
              <a href={`/posts/${post()?.slug}?preview=admin`} target="_blank" class="btn btn--secondary">Preview Draft &nearr;</a>
            </Show>
          </Show>
          <button class="btn btn--primary" onClick={handleSave} disabled={saving()}>
            {saving() ? 'Saving...' : 'Save Post'}
          </button>
        </div>
      </div>
      <Show when={error()}>
        <div class="alert alert--error">{error()}</div>
      </Show>
      <div class="admin-form">
        <div class="form-section">
          <h2>Post Details</h2>
          <div class="form-group">
            <label>Title</label>
            <input type="text" value={title()} onInput={(e) => { setTitle(e.currentTarget.value); markDirty(); }} placeholder="Post title" />
          </div>
          <div class="form-row">
            <div class="form-group form-group--grow">
              <label>Slug</label>
              <input type="text" value={slug()} onInput={(e) => { setSlug(e.currentTarget.value); markDirty(); }} placeholder="post-slug" />
              <span class="form-help">URL path: /posts/{slug() || 'post-slug'}</span>
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
              <span class="form-help">Who can view this post</span>
            </div>
          </div>
          <div class="form-group">
            <label>Excerpt</label>
            <textarea rows={3} value={excerpt()} onInput={(e) => { setExcerpt(e.currentTarget.value); markDirty(); }} placeholder="Brief summary of the post..." />
          </div>
          <div class="form-group">
            <label>Tags</label>
            <input type="text" value={tags()} onInput={(e) => { setTags(e.currentTarget.value); markDirty(); }} placeholder="tag1, tag2, tag3" />
            <span class="form-help">Comma-separated list of tags</span>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header">
            <h2>Content Blocks</h2>
          </div>
          <BlockEditor
            blocks={blocks()}
            onBlocksChange={(newBlocks) => { setBlocks(newBlocks); markDirty(); }}
          />
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

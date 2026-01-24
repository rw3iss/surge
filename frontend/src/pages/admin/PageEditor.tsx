import { Component, createSignal, createResource, createEffect, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { api } from '../../services/api';

const AdminPageEditor: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = () => params.id === 'new';

  const [page] = createResource(() => isNew() ? null : params.id, async (id) => {
    if (!id) return null;
    const response = await api.get(`/pages/${id}`);
    return response.success ? (response as any).data : null;
  });

  const [title, setTitle] = createSignal('');
  const [slug, setSlug] = createSignal('');
  const [status, setStatus] = createSignal('draft');
  const [error, setError] = createSignal('');

  createEffect(() => {
    const p = page();
    if (p) {
      setTitle(p.title || '');
      setSlug(p.slug || '');
      setStatus(p.status || 'draft');
    }
  });

  const handleSave = async () => {
    setError('');
    if (!title()) { setError('Title is required'); return; }
    if (!slug()) { setError('Slug is required'); return; }

    const data = { title: title(), slug: slug(), status: status() };
    const response = isNew()
      ? await api.post('/pages', data)
      : await api.put(`/pages/${params.id}`, data);
    if (response.success) {
      navigate('/admin/pages');
    } else {
      setError((response as any).error?.message || 'Failed to save page');
    }
  };

  return (
    <div>
      <Title>{isNew() ? 'New Page' : 'Edit Page'} - Admin - Surge Media</Title>
      <div class="admin-header">
        <h1>{isNew() ? 'New Page' : 'Edit Page'}</h1>
      </div>
      <Show when={error()}>
        <div class="alert alert--error">{error()}</div>
      </Show>
      <div class="admin-form">
        <div class="form-section">
          <h2>Page Details</h2>
          <div class="form-group">
            <label>Title</label>
            <input type="text" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Page title" />
          </div>
          <div class="form-row">
            <div class="form-group form-group--grow">
              <label>Slug</label>
              <input type="text" value={slug()} onInput={(e) => setSlug(e.currentTarget.value)} placeholder="page-slug" />
              <span class="form-help">URL path for this page (e.g. "about" → /about)</span>
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
        </div>
        <Show when={!isNew() && page()?.blocks?.length}>
          <div class="form-section">
            <h2>Blocks</h2>
            <For each={page()?.blocks}>
              {(block: any) => (
                <div class="question-card">
                  <div class="question-header">
                    <span class="question-number">{block.type}</span>
                  </div>
                  <div class="question-body">
                    {block.title || block.type}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <div class="form-actions">
          <button class="btn btn--primary" onClick={handleSave}>Save Page</button>
          <button class="btn btn--secondary" onClick={() => navigate('/admin/pages')}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AdminPageEditor;

import { Component, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { api } from '../../services/api';

const AdminPages: Component = () => {
  const [pages] = createResource(async () => {
    const response = await api.get('/pages');
    return response.success ? (response as any).data : [];
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'published': return 'badge--success';
      case 'draft': return 'badge--warning';
      case 'archived': return 'badge--muted';
      default: return 'badge--muted';
    }
  };

  return (
    <div>
      <Title>Pages - Admin - Surge Media</Title>
      <div class="admin-header">
        <h1>Pages</h1>
        <A href="/admin/pages/new" class="btn btn--primary">New Page</A>
      </div>
      <Show when={pages()?.length} fallback={<div class="empty-state">No pages yet. Create your first page.</div>}>
        <div class="admin-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={pages()}>
                {(page: any) => (
                  <tr>
                    <td><A href={`/admin/pages/${page.id}`} class="table-link">{page.title}</A></td>
                    <td>/{page.slug}</td>
                    <td><span class={`badge ${statusBadge(page.status)}`}>{page.status}</span></td>
                    <td><A href={`/admin/pages/${page.id}`} class="btn btn--small btn--secondary">Edit</A></td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
};

export default AdminPages;

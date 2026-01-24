import { Component, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { api } from '../../services/api';

const AdminPosts: Component = () => {
  const [posts] = createResource(async () => {
    const response = await api.get('/posts?all=true');
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
      <Title>Posts - Admin - Surge Media</Title>
      <div class="admin-header">
        <h1>Posts</h1>
        <A href="/admin/posts/new" class="btn btn--primary">New Post</A>
      </div>
      <Show when={posts()?.length} fallback={<div class="empty-state">No posts yet. Create your first post.</div>}>
        <div class="admin-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Blocks</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={posts()}>
                {(post: any) => (
                  <tr>
                    <td><A href={`/admin/posts/${post.id}`} class="table-link">{post.title}</A></td>
                    <td><span class={`badge ${statusBadge(post.status)}`}>{post.status}</span></td>
                    <td>{post.blockCount || 0}</td>
                    <td>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '—'}</td>
                    <td><A href={`/admin/posts/${post.id}`} class="btn btn--small btn--secondary">Edit</A></td>
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

export default AdminPosts;

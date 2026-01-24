import { Component, createResource, For, createSignal, Show } from 'solid-js';
import { Title } from '@solidjs/meta';
import { api } from '../../services/api';

const AdminMedia: Component = () => {
  const [refresh, setRefresh] = createSignal(0);
  const [media, { refetch }] = createResource(() => refresh(), async () => {
    const response = await api.get('/media');
    return response.success ? (response as any).data : [];
  });

  const handleUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) {
      await api.upload('/media', input.files[0]);
      refetch();
    }
  };

  return (
    <div>
      <Title>Media - Admin - Surge Media</Title>
      <div class="admin-header">
        <h1>Media Library</h1>
        <label class="btn btn--primary">
          Upload File
          <input type="file" onChange={handleUpload} accept="image/*,video/*,application/pdf" style={{ display: 'none' }} />
        </label>
      </div>
      <Show when={media()?.length} fallback={<div class="empty-state">No media uploaded yet.</div>}>
        <div class="media-grid">
          <For each={media()}>
            {(m: any) => (
              <div class="media-grid__item">
                <div class="media-grid__preview">
                  <img src={m.thumbnailUrl || m.url} alt={m.alt || m.originalName} />
                </div>
                <div class="media-grid__name">{m.originalName}</div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default AdminMedia;

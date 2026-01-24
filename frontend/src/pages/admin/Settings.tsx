import { Component, createResource, createSignal, Show } from 'solid-js';
import { Title } from '@solidjs/meta';
import { api } from '../../services/api';

const AdminSettings: Component = () => {
  const [settings, { refetch }] = createResource(async () => {
    const response = await api.get('/settings');
    return response.success ? (response as any).data : {};
  });

  const [saving, setSaving] = createSignal(false);
  const [success, setSuccess] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data: Record<string, any> = {};
    formData.forEach((value, key) => { data[key] = value; });
    data.maintenanceMode = (form.querySelector('[name="maintenanceMode"]') as HTMLInputElement)?.checked || false;
    await api.put('/settings', data);
    setSaving(false);
    setSuccess(true);
    refetch();
  };

  return (
    <div>
      <Title>Settings - Admin - Surge Media</Title>
      <div class="admin-header">
        <h1>Site Settings</h1>
      </div>
      <Show when={success()}>
        <div class="alert alert--success">Settings saved successfully.</div>
      </Show>
      <div class="admin-form">
        <form onSubmit={handleSubmit}>
          <div class="form-section">
            <h2>General</h2>
            <div class="form-group">
              <label>Site Name</label>
              <input type="text" name="siteName" value={settings()?.siteName || ''} />
            </div>
            <div class="form-group">
              <label>Tagline</label>
              <input type="text" name="tagline" value={settings()?.tagline || ''} />
            </div>
            <div class="form-group">
              <label>Contact Email</label>
              <input type="email" name="contactEmail" value={settings()?.contactEmail || ''} />
            </div>
          </div>
          <div class="form-section">
            <h2>Integrations</h2>
            <div class="form-group">
              <label>Analytics ID</label>
              <input type="text" name="analyticsId" value={settings()?.analyticsId || ''} />
              <span class="form-help">Google Analytics measurement ID (e.g. G-XXXXXXX)</span>
            </div>
          </div>
          <div class="form-section">
            <h2>Maintenance</h2>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" name="maintenanceMode" checked={settings()?.maintenanceMode} />
                Enable Maintenance Mode
              </label>
              <span class="form-help">When enabled, only admins can access the site.</span>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn--primary" disabled={saving()}>
              {saving() ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminSettings;

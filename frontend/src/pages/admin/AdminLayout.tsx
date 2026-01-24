import { ParentComponent, Show, createEffect } from 'solid-js';
import { A, useNavigate, useLocation } from '@solidjs/router';
import { useAuth } from '../../stores/auth';
import './AdminLayout.scss';

const AdminLayout: ParentComponent = (props) => {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  createEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      navigate(`/login?return=${location.pathname}`);
    } else if (!auth.isLoading && auth.user?.role !== 'admin') {
      navigate('/');
    }
  });

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <Show when={!auth.isLoading && auth.user?.role === 'admin'} fallback={<div>Loading...</div>}>
      <div class="admin-layout">
        <aside class="admin-layout__sidebar">
          <div class="admin-layout__logo">
            <A href="/">Surge Media</A>
          </div>
          <nav class="admin-layout__nav">
            <A href="/admin" class={`admin-layout__nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>Dashboard</A>
            <A href="/admin/pages" class={`admin-layout__nav-link ${isActive('/admin/pages') ? 'active' : ''}`}>Pages</A>
            <A href="/admin/posts" class={`admin-layout__nav-link ${isActive('/admin/posts') ? 'active' : ''}`}>Posts</A>
            <A href="/admin/campaigns" class={`admin-layout__nav-link ${isActive('/admin/campaigns') ? 'active' : ''}`}>Campaigns</A>
            <A href="/admin/forms" class={`admin-layout__nav-link ${isActive('/admin/forms') ? 'active' : ''}`}>Forms</A>
            <A href="/admin/users" class={`admin-layout__nav-link ${isActive('/admin/users') ? 'active' : ''}`}>Users</A>
            <A href="/admin/messages" class={`admin-layout__nav-link ${isActive('/admin/messages') ? 'active' : ''}`}>Messages</A>
            <A href="/admin/media" class={`admin-layout__nav-link ${isActive('/admin/media') ? 'active' : ''}`}>Media</A>
            <A href="/admin/connections" class={`admin-layout__nav-link ${isActive('/admin/connections') ? 'active' : ''}`}>Connections</A>
            <A href="/admin/settings" class={`admin-layout__nav-link ${isActive('/admin/settings') ? 'active' : ''}`}>Settings</A>
          </nav>
          <div class="admin-layout__user">
            <span>{auth.user?.displayName}</span>
            <button onClick={() => auth.logout()}>Logout</button>
          </div>
        </aside>
        <main class="admin-layout__main">
          {props.children}
        </main>
      </div>
    </Show>
  );
};

export default AdminLayout;

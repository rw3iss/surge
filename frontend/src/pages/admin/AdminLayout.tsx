import { A, useLocation, useNavigate, } from '@solidjs/router';
import { createEffect, createSignal, For, ParentComponent, Show, } from 'solid-js';
import GlobalSearch from '../../components/admin/GlobalSearch';
import SiteLogo from '../../components/SiteLogo';
import { useAuth, } from '../../stores/auth';
import './AdminLayout.scss';

/** Minimal outline SVG icons for sidebar nav items (16x16 viewBox) */
const ICONS: Record<string, string> = {
    dashboard: '<path d="M3 3h4v5H3V3zm6 0h4v3H9V3zm0 5h4v5H9V8zM3 10h4v3H3v-3z" stroke="currentColor" fill="none" stroke-width="1.2"/>',
    pages: '<path d="M4 2h5l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" fill="none" stroke-width="1.2"/><path d="M9 2v3h3" stroke="currentColor" fill="none" stroke-width="1.2"/>',
    posts: '<path d="M3 3h10v10H3z" stroke="currentColor" fill="none" stroke-width="1.2"/><path d="M5 6h6M5 8h6M5 10h4" stroke="currentColor" stroke-width="1.2"/>',
    campaigns: '<path d="M8 2a6 6 0 110 12A6 6 0 018 2z" stroke="currentColor" fill="none" stroke-width="1.2"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.2" fill="none"/>',
    forms: '<path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" fill="none" stroke-width="1.2"/><path d="M5 5h1M5 8h1M5 11h1M8 5h3M8 8h3M8 11h3" stroke="currentColor" stroke-width="1.2"/>',
    media: '<path d="M2 4h12v8H2z" stroke="currentColor" fill="none" stroke-width="1.2"/><circle cx="5" cy="7" r="1.2" stroke="currentColor" fill="none" stroke-width="1"/><path d="M2 10l3-2 2 1 3-3 4 4" stroke="currentColor" fill="none" stroke-width="1.2"/>',
    users: '<circle cx="8" cy="5" r="2.5" stroke="currentColor" fill="none" stroke-width="1.2"/><path d="M3 14c0-3 2.5-5 5-5s5 2 5 5" stroke="currentColor" fill="none" stroke-width="1.2"/>',
    messages: '<path d="M2 3h12v8H6l-3 2v-2H2V3z" stroke="currentColor" fill="none" stroke-width="1.2"/>',
    connections: '<circle cx="5" cy="5" r="2" stroke="currentColor" fill="none" stroke-width="1.2"/><circle cx="11" cy="11" r="2" stroke="currentColor" fill="none" stroke-width="1.2"/><path d="M6.5 6.5l3 3" stroke="currentColor" stroke-width="1.2"/>',
    settings: '<circle cx="8" cy="8" r="2.5" stroke="currentColor" fill="none" stroke-width="1.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" stroke="currentColor" stroke-width="1"/>',
    developer: '<path d="M5 5L2 8l3 3M11 5l3 3-3 3M9 3l-2 10" stroke="currentColor" fill="none" stroke-width="1.2"/>',
    collapse: '<path d="M11 3L5 8l6 5" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    expand: '<path d="M5 3l6 5-6 5" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
};

function NavIcon(props: { name: string; },) {
    return (
        <svg
            class="admin-layout__nav-icon"
            viewBox="0 0 16 16"
            width="18"
            height="18"
            innerHTML={ICONS[props.name] || ''}
        />
    );
}

interface NavItem {
    path: string;
    label: string;
    icon: string;
    end?: boolean;
    sysadminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { path: '/admin', label: 'Dashboard', icon: 'dashboard', end: true, },
    { path: '/admin/pages', label: 'Pages', icon: 'pages', },
    { path: '/admin/posts', label: 'Posts', icon: 'posts', },
    { path: '/admin/campaigns', label: 'Campaigns', icon: 'campaigns', },
    { path: '/admin/forms', label: 'Forms', icon: 'forms', },
    { path: '/admin/media', label: 'Media', icon: 'media', },
    { path: '/admin/users', label: 'Users', icon: 'users', },
    { path: '/admin/messages', label: 'Messages', icon: 'messages', },
    { path: '/admin/settings', label: 'Settings', icon: 'settings', },
    { path: '/admin/developer', label: 'Developer', icon: 'developer', sysadminOnly: true, },
];

const COLLAPSED_KEY = 'admin-sidebar-collapsed';

const AdminLayout: ParentComponent = (props,) => {
    const auth = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen,] = createSignal(false,);
    const [collapsed, setCollapsed,] = createSignal(
        typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSED_KEY,) === '1',
    );

    createEffect(() => {
        if (!auth.isLoading && !auth.isAuthenticated) {
            navigate(`/login?return=${location.pathname}`,);
        } else if (!auth.isLoading && auth.user?.role !== 'admin' && auth.user?.role !== 'sysadmin') {
            navigate('/',);
        }
    },);

    createEffect(() => {
        location.pathname;
        setSidebarOpen(false,);
    },);

    const isActive = (path: string, end?: boolean,) =>
        end ? location.pathname === path : (location.pathname === path || location.pathname.startsWith(`${path}/`,));

    const handleNavClick = () => setSidebarOpen(false,);

    const toggleCollapsed = () => {
        const next = !collapsed();
        setCollapsed(next,);
        try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0',); } catch { /* ignore */ }
    };

    return (
        <Show when={!auth.isLoading && (auth.user?.role === 'admin' || auth.user?.role === 'sysadmin')} fallback={<div>Loading...</div>}>
            <div class={`admin-layout ${collapsed() ? 'admin-layout--collapsed' : ''}`}>
                <button
                    class={`admin-layout__hamburger ${sidebarOpen() ? 'admin-layout__hamburger--open' : ''}`}
                    onClick={() => setSidebarOpen(!sidebarOpen(),)}
                    aria-label="Toggle navigation"
                >
                    <span />
                    <span />
                    <span />
                </button>
                <Show when={sidebarOpen()}>
                    <div class="admin-layout__overlay" onClick={() => setSidebarOpen(false,)} />
                </Show>
                <aside class={`admin-layout__sidebar ${sidebarOpen() ? 'admin-layout__sidebar--open' : ''}`}>
                    <div class="admin-layout__logo">
                        <A href="/" onClick={handleNavClick}>
                            <SiteLogo size="small" />
                        </A>
                    </div>
                    <nav class="admin-layout__nav">
                        <For each={NAV_ITEMS}>
                            {(item,) => (
                                <Show when={!item.sysadminOnly || auth.user?.role === 'sysadmin'}>
                                    <A
                                        href={item.path}
                                        end={item.end}
                                        class={`admin-layout__nav-link ${isActive(item.path, item.end,) ? 'active' : ''}`}
                                        onClick={handleNavClick}
                                        title={collapsed() ? item.label : undefined}
                                    >
                                        <NavIcon name={item.icon} />
                                        <span class="admin-layout__nav-label">{item.label}</span>
                                    </A>
                                </Show>
                            )}
                        </For>
                    </nav>
                    <div class="admin-layout__sidebar-footer">
                        <div class="admin-layout__user">
                            <Show
                                when={!collapsed()}
                                fallback={
                                    <button
                                        class="admin-layout__user-avatar"
                                        onClick={() => auth.logout()}
                                        title={`${auth.user?.displayName} — click to log out`}
                                    >
                                        <Show
                                            when={auth.user?.avatarUrl}
                                            fallback={(auth.user?.displayName || 'U').charAt(0,).toUpperCase()}
                                        >
                                            <img src={auth.user!.avatarUrl!} alt="" class="admin-layout__user-avatar-img" />
                                        </Show>
                                    </button>
                                }
                            >
                                <div class="admin-layout__user-avatar">
                                    <Show
                                        when={auth.user?.avatarUrl}
                                        fallback={(auth.user?.displayName || 'U').charAt(0,).toUpperCase()}
                                    >
                                        <img src={auth.user!.avatarUrl!} alt="" class="admin-layout__user-avatar-img" />
                                    </Show>
                                </div>
                                <div class="admin-layout__user-info">
                                    <span class="admin-layout__user-name">{auth.user?.displayName}</span>
                                    <button class="admin-layout__user-logout" onClick={() => auth.logout()}>
                                        Log out
                                    </button>
                                </div>
                            </Show>
                        </div>
                        <button
                            class="admin-layout__collapse-toggle"
                            onClick={toggleCollapsed}
                            title={collapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <NavIcon name={collapsed() ? 'expand' : 'collapse'} />
                        </button>
                    </div>
                </aside>
                <main class="admin-layout__main">
                    {props.children}
                </main>
                <GlobalSearch />
            </div>
        </Show>
    );
};

export default AdminLayout;

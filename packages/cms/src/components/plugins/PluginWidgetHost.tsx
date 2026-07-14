/**
 * Mounts enabled plugins' public-site widgets. Framework-agnostic: each plugin
 * bundle is dynamically imported and given a plain DOM element + host context.
 * Per-plugin `adminOnly` config gates the widget to signed-in admins.
 * Rendered once in the public Layout (after the footer).
 */
import { Component, For, createResource, onCleanup, onMount } from 'solid-js';
import type { PublicPlugin } from '@sitesurge/types';
import { cms } from '../../services/cmsClient';
import { useAuth, useIsAdmin } from '../../stores/auth';
import { isFeatureEnabled, siteSettings } from '../../stores/siteSettings';
import { buildHost, loadPluginModule } from '../../plugins/host';

const PluginWidgetMount: Component<{
    plugin: PublicPlugin;
    isAdmin: boolean;
    user: { id: string; role: string } | null;
}> = (props) => {
    let el: HTMLDivElement | undefined;
    const cleanups: Array<() => void> = [];

    onMount(async () => {
        if (!props.plugin.clientUrl || !el) return;
        try {
            const mod = await loadPluginModule(props.plugin.clientUrl);
            const host = buildHost({
                name: props.plugin.name,
                config: props.plugin.config,
                settings: (siteSettings() ?? {}) as Record<string, unknown>,
                user: props.user,
                isAdmin: props.isAdmin,
                mountPoint: el,
                cleanups,
            });
            const teardown = mod.mountWidget?.(el, host);
            if (typeof teardown === 'function') cleanups.push(teardown);
        } catch (err) {
            // A broken plugin must never break the site.
            console.warn(`[plugins] "${props.plugin.name}" widget failed to load`, err);
        }
    });

    onCleanup(() => {
        for (const fn of cleanups) {
            try { fn(); } catch { /* ignore teardown errors */ }
        }
    });

    return <div ref={el} class="plugin-widget" data-plugin={props.plugin.name} />;
};

const PluginWidgetHost: Component = () => {
    const auth = useAuth();
    const isAdmin = useIsAdmin();

    // Reactive SOURCE = the plugins feature flag. On a hard refresh the public
    // Layout loads settings asynchronously, so at mount the flag is still the
    // pre-load default (false); a plain fetcher would return [] and never retry.
    // Keying the resource on isFeatureEnabled('plugins') (which tracks the
    // settings store) refetches automatically once settings resolve. When the
    // flag is false, createResource skips the fetcher entirely.
    const [plugins] = createResource(
        () => isFeatureEnabled('plugins'),
        async () => {
            try {
                return await cms.plugins.listEnabled();
            } catch {
                return [] as PublicPlugin[];
            }
        },
    );

    const currentUser = (): { id: string; role: string } | null =>
        auth.user ? { id: auth.user.id, role: String(auth.user.role) } : null;

    const visible = (): PublicPlugin[] =>
        (plugins() ?? []).filter(
            (p) => p.clientUrl && p.capabilities.includes('public-widget') && (!p.adminOnly || isAdmin()),
        );

    return (
        <For each={visible()}>
            {(p) => <PluginWidgetMount plugin={p} isAdmin={isAdmin()} user={currentUser()} />}
        </For>
    );
};

export default PluginWidgetHost;

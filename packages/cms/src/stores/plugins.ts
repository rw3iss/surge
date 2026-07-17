import type { PublicPlugin, } from '@sitesurge/types';
import { createSignal, } from 'solid-js';
import { cms, } from '../services/cmsClient';

/**
 * Enabled-plugins singleton (public projection). Mirrors `stores/siteSettings`.
 * Fetches /plugins/enabled once and caches; components read it synchronously via
 * `enabledPlugins()` (null until first load completes) or the helpers below.
 * Used to gate plugin-specific UI (e.g. the GiveButter panel on the Campaign
 * editor) and to read a plugin's PUBLIC config (secrets are already stripped
 * server-side, so e.g. GiveButter's `accountId` is available; `apiKey` is not).
 */
const [enabledPlugins, setEnabledPlugins,] = createSignal<PublicPlugin[] | null>(null,);
let fetchPromise: Promise<PublicPlugin[]> | null = null;

export function loadEnabledPlugins(force = false,): Promise<PublicPlugin[]> {
    if (!force && enabledPlugins() !== null) return Promise.resolve(enabledPlugins()!,);
    if (fetchPromise) return fetchPromise;
    fetchPromise = (async () => {
        try {
            const data = await cms.plugins.listEnabled();
            setEnabledPlugins(data ?? [],);
            return data ?? [];
        } catch {
            setEnabledPlugins([],);
            return [];
        } finally {
            fetchPromise = null;
        }
    })();
    return fetchPromise;
}

export { enabledPlugins, };

/** Whether a plugin is installed + enabled (reactive). */
export function isPluginEnabled(name: string,): boolean {
    return (enabledPlugins() ?? []).some((p,) => p.name === name);
}

/** A plugin's PUBLIC config (secrets already stripped); empty when not enabled. */
export function pluginConfig(name: string,): Record<string, unknown> {
    return (enabledPlugins() ?? []).find((p,) => p.name === name)?.config ?? {};
}

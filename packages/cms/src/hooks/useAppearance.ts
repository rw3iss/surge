import { createResource, type Resource, } from 'solid-js';
import type { AppearanceSettings, } from '@sitesurge/types';
import { cms, } from '../services/cmsClient';

/**
 * Shared appearance-settings resource. Replaces the identical
 * `createResource(async () => { try { return await cms.settings.getAppearance() }
 * catch { return null } })` boilerplate that was copy-pasted across the page /
 * post editors, layout, admin shell, and settings. Each call creates its own
 * resource (preserving the previous per-component fetch semantics); the value
 * is `null` on failure or before the first load resolves.
 */
export function useAppearance(): Resource<AppearanceSettings | null> {
    const [appearance,] = createResource(async () => {
        try {
            return (await cms.settings.getAppearance()) as AppearanceSettings;
        } catch {
            return null;
        }
    },);
    return appearance;
}

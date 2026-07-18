import { createResource, JSX, ParentComponent, Show, } from 'solid-js';
import { isFeatureEnabled, loadSiteSettings, } from '../../stores/siteSettings';
import { loadEnabledPlugins, } from '../../stores/plugins';

interface FeatureReadyGuardProps {
    /** Feature key that must be enabled for the children to render. */
    feature: string;
    /** Shown when the feature is disabled. */
    fallback: JSX.Element;
    /** Shown while settings/plugins are still loading. */
    loading?: JSX.Element;
}

/**
 * Shared page-level guard: waits for site settings + enabled plugins to resolve
 * (so `isFeatureEnabled`/`isPluginEnabled` are ready and we don't flash the
 * disabled state), then renders the children only when `feature` is enabled,
 * else the caller-supplied `fallback`. Backs both the public `ShopStoreGuard`
 * and the admin `ShopGuard`, which previously duplicated this logic verbatim
 * (only their fallback markup differs).
 */
const FeatureReadyGuard: ParentComponent<FeatureReadyGuardProps> = (props,) => {
    const [ready,] = createResource(async () => {
        await Promise.all([loadSiteSettings(), loadEnabledPlugins(),],);
        return true;
    },);

    return (
        <Show when={ready()} fallback={props.loading ?? <div class="empty-state">Loading…</div>}>
            <Show when={isFeatureEnabled(props.feature,)} fallback={props.fallback}>
                {props.children}
            </Show>
        </Show>
    );
};

export default FeatureReadyGuard;

import { isPluginEnabled, loadEnabledPlugins, } from '../stores/plugins';

/**
 * Kick off the enabled-plugins load (idempotent, cached) and return a REACTIVE
 * accessor for whether `name` is enabled. Consolidates the
 * `void loadEnabledPlugins(); … isPluginEnabled('x')` boilerplate repeated across
 * the campaign/GiveButter surfaces. Reads the shared `enabledPlugins` signal, so
 * the accessor updates when the load resolves.
 */
export function usePluginEnabled(name: string,): () => boolean {
    void loadEnabledPlugins();
    return () => isPluginEnabled(name,);
}

import { createSignal, onMount, Show, } from 'solid-js';
import { isServer, } from 'solid-js/web';
import { pluginConfig, } from '../../stores/plugins';
import './GiveButterWidget.scss';

/**
 * Renders a GiveButter donation widget for a campaign. Loads the GiveButter
 * widgets library once (keyed by the plugin's public `accountId`) and drops in
 * the campaign-code custom element. Donations flow straight to GiveButter — the
 * internal Stripe path is bypassed for GiveButter campaigns.
 *
 * The custom elements aren't in Solid's JSX types, so we inject via innerHTML on
 * a wrapper. `code` is a short server-controlled token (not user input), so this
 * is safe from injection.
 */
let libLoaded = false;

function ensureLib(accountId: string,): void {
    if (isServer || libLoaded || !accountId) return;
    if (document.querySelector('script[data-givebutter]',)) { libLoaded = true; return; }
    const s = document.createElement('script',);
    s.async = true;
    s.src = `https://widgets.givebutter.com/latest.umd.cjs?acct=${encodeURIComponent(accountId,)}`;
    s.setAttribute('data-givebutter', '1',);
    document.head.appendChild(s,);
    libLoaded = true;
}

const TAGS: Record<string, string> = {
    'giving-form': 'givebutter-giving-form',
    button: 'givebutter-button',
    'goal-bar': 'givebutter-goal-bar',
};

const GiveButterWidget = (props: { code?: string | null; type?: string; },) => {
    const [ready, setReady,] = createSignal(false,);

    onMount(() => {
        const acct = String(pluginConfig('givebutter',).accountId || '',);
        ensureLib(acct,);
        setReady(Boolean(acct && props.code),);
    },);

    const tag = () => TAGS[props.type || 'giving-form'] || TAGS['giving-form'];

    return (
        <Show
            when={ready() && props.code}
            fallback={
                <div class="gb-widget__missing">
                    This campaign isn't linked to GiveButter yet.
                </div>
            }
        >
            <div
                class="gb-widget"
                // eslint-disable-next-line solid/no-innerhtml
                innerHTML={`<${tag()} campaign="${props.code}"></${tag()}>`}
            />
        </Show>
    );
};

export default GiveButterWidget;

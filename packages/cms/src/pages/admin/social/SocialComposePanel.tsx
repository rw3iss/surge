import { Component, createResource, createSignal, For, Show, } from 'solid-js';
import type { SocialPublishResult, } from '@sitesurge/types';
import { cms, } from '../../../services/cmsClient';

/** Providers that currently support composing/publishing from the CMS. */
const PUBLISHABLE = new Set(['twitter',],);
const PROVIDERS = ['twitter', 'facebook', 'instagram', 'tiktok', 'patreon', 'youtube',];
const LABELS: Record<string, string> = {
    twitter: 'X / Twitter', facebook: 'Facebook', instagram: 'Instagram',
    tiktok: 'TikTok', patreon: 'Patreon', youtube: 'YouTube',
};
const MAX_LEN = 280;

const SocialComposePanel: Component = () => {
    const [text, setText,] = createSignal('',);
    const [selected, setSelected,] = createSignal<Record<string, boolean>>({ twitter: true, },);
    const [busy, setBusy,] = createSignal(false,);
    const [results, setResults,] = createSignal<SocialPublishResult[] | null>(null,);
    const [error, setError,] = createSignal('',);

    const [connections,] = createResource(async () => {
        try {
            return await cms.connections.list() as any[];
        } catch {
            return [] as any[];
        }
    },);

    const isConnected = (provider: string,): boolean =>
        Boolean(connections()?.find((c: any,) => c.provider === provider)?.isConnected,);
    const canPublish = (provider: string,): boolean => PUBLISHABLE.has(provider,) && isConnected(provider,);

    const toggle = (provider: string,): void => {
        if (!canPublish(provider,)) return;
        setSelected((s,) => ({ ...s, [provider]: !s[provider], }),);
    };

    const chosen = (): string[] => PROVIDERS.filter((p,) => selected()[p] && canPublish(p,),);

    const publish = async (): Promise<void> => {
        setError('',);
        setResults(null,);
        const providers = chosen();
        if (!text().trim()) { setError('Write something to post.',); return; }
        if (providers.length === 0) { setError('Select at least one connected provider.',); return; }
        setBusy(true,);
        try {
            const res = await cms.social.publish({ providers, text: text().trim(), },);
            setResults(res.results,);
            if (res.results.every((r,) => r.ok)) setText('',);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Publish failed.',);
        } finally {
            setBusy(false,);
        }
    };

    const overLimit = (): boolean => selected().twitter && text().length > MAX_LEN;

    return (
        <section class="social-compose">
            <div class="social-compose__editor">
                <textarea
                    class="social-compose__text"
                    rows={5}
                    placeholder="What's happening?"
                    value={text()}
                    onInput={(e,) => setText(e.currentTarget.value,)}
                />
                <div class="social-compose__meta">
                    <span class={`social-compose__count ${overLimit() ? 'is-over' : ''}`}>
                        {text().length}{selected().twitter ? ` / ${MAX_LEN}` : ''}
                    </span>
                </div>
            </div>

            <div class="social-compose__providers">
                <For each={PROVIDERS}>
                    {(provider,) => {
                        const publishable = () => canPublish(provider,);
                        const reason = () =>
                            !PUBLISHABLE.has(provider,)
                                ? 'Publishing not supported yet'
                                : !isConnected(provider,)
                                ? 'Not connected — set it up in Configuration'
                                : '';
                        return (
                            <label
                                class={`social-compose__provider ${publishable() ? '' : 'is-disabled'}`}
                                title={reason()}
                            >
                                <input
                                    type="checkbox"
                                    checked={Boolean(selected()[provider]) && publishable()}
                                    disabled={!publishable()}
                                    onChange={() => toggle(provider,)}
                                />
                                <span>{LABELS[provider]}</span>
                                <Show when={!publishable()}>
                                    <span class="social-compose__provider-note">{reason()}</span>
                                </Show>
                            </label>
                        );
                    }}
                </For>
            </div>

            <Show when={error()}>
                <div class="alert alert--error">{error()}</div>
            </Show>

            <Show when={results()}>
                {(rs,) => (
                    <ul class="social-compose__results">
                        <For each={rs()}>
                            {(r,) => (
                                <li class={r.ok ? 'is-ok' : 'is-error'}>
                                    <strong>{LABELS[r.provider] ?? r.provider}:</strong>{' '}
                                    {r.ok ? `Published (${r.id})` : r.error}
                                </li>
                            )}
                        </For>
                    </ul>
                )}
            </Show>

            <div class="social-compose__actions">
                <button
                    class="btn btn--primary"
                    disabled={busy() || overLimit()}
                    onClick={publish}
                >
                    {busy() ? 'Publishing…' : 'Publish'}
                </button>
            </div>

            <p class="form-help">
                Posts you publish here are captured back into the feed automatically. X uses the free
                write tier — no paid API needed. Media attachments are coming soon.
            </p>
        </section>
    );
};

export default SocialComposePanel;

import { Component, createResource, For, Show, } from 'solid-js';
import { hasTemplateSyntax, type OutputNode, renderTemplate, } from '../../services/template';
import { buildRuntime, type RuntimeOptions, } from '../../services/template/runtime';
import { useUser, } from '../../stores/auth';
import { siteSettings, } from '../../stores/siteSettings';
import TemplateEntity from './TemplateEntity';
import './TemplatedContent.scss';

interface TemplatedContentProps {
    /** Raw block HTML/text, possibly containing `{{ … }}`. */
    html: string | null | undefined;
    /** Page-entity context, e.g. `{ post: { kind:'post', data, id } }`. */
    entities?: RuntimeOptions['entities'];
    /** Class applied to the wrapping element (e.g. `rich-text`). */
    class?: string;
}

/** Strip `{{ … }}` tags — used for the loading fallback so raw braces never
 *  flash before the template resolves. */
function stripTags(html: string): string {
    return html.replace(/\{\{[^{}]*\}\}/g, '');
}

/**
 * Renders block content, resolving any `{{ … }}` template syntax against the
 * CMS runtime (variables, entity functions, if/for). Content with no template
 * syntax renders identically to a plain `innerHTML` div — zero overhead. When
 * whole-entity refs are present, HTML chunks and entity components are
 * interleaved (HTML chunks use `display:contents` so block markup isn't broken).
 */
const TemplatedContent: Component<TemplatedContentProps> = (props,) => {
    const auth = useUser();

    const [nodes] = createResource(
        () => ({ html: props.html ?? '', entities: props.entities, uid: auth.user?.id ?? null }),
        async (src): Promise<OutputNode[]> => {
            if (!hasTemplateSyntax(src.html)) return [{ type: 'html', html: src.html }];
            const u = auth.user;
            const rt = buildRuntime({
                entities: src.entities,
                user: u
                    ? { name: u.displayName, displayName: u.displayName, email: u.email, role: u.role, id: u.id, avatarUrl: u.avatarUrl }
                    : null,
                site: (siteSettings() ?? null) as Record<string, unknown> | null,
            },);
            return renderTemplate(src.html, rt,);
        },
    );

    // Common case: no template syntax (or a single resolved HTML chunk) → render
    // exactly like the prior `innerHTML` div, no extra wrappers.
    const single = () => {
        const n = nodes();
        return n && n.length === 1 && n[0].type === 'html' ? n[0].html : null;
    };

    return (
        <Show
            when={nodes()}
            fallback={<div class={props.class} innerHTML={stripTags(props.html ?? '',)} />}
        >
            <Show
                when={single() === null}
                fallback={<div class={props.class} innerHTML={single()!} />}
            >
                <div class={props.class}>
                    <For each={nodes()}>
                        {(n,) =>
                            n.type === 'html'
                                ? <div style={{ display: 'contents', }} innerHTML={n.html} />
                                : <TemplateEntity kind={n.kind} data={n.data} />}
                    </For>
                </div>
            </Show>
        </Show>
    );
};

export default TemplatedContent;

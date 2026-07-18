import { A, } from '@solidjs/router';
import { Component, For, } from 'solid-js';
import { FUNCTIONS, LOGIC_EXAMPLES, SYNTAX_EXAMPLES, } from '../../../services/template/reference';
import './TemplateReference.scss';

/**
 * Compact `{{ … }}` variable + function reference shown inside the block Edit
 * panel. The full documentation (with every entity's schema) lives at
 * /admin/help/variables-and-functions.
 */
const TemplateReference: Component = () => (
    <div class="tpl-ref">
        <p class="tpl-ref__intro">
            Embed <code>{'{{ … }}'}</code> anywhere in this block's content to pull in live data.
            Unresolved tags are ignored (a warning is logged to the console).
        </p>

        <h4 class="tpl-ref__heading">Syntax</h4>
        <For each={SYNTAX_EXAMPLES}>
            {(ex,) => (
                <div class="tpl-ref__item">
                    <code class="tpl-ref__code">{ex.code}</code>
                    <span class="tpl-ref__desc">{ex.desc}</span>
                </div>
            )}
        </For>

        <h4 class="tpl-ref__heading">Logic</h4>
        <For each={LOGIC_EXAMPLES}>
            {(ex,) => (
                <div class="tpl-ref__item tpl-ref__item--block">
                    <span class="tpl-ref__desc">{ex.title} — {ex.desc}</span>
                    <pre class="tpl-ref__pre">{ex.code}</pre>
                </div>
            )}
        </For>

        <h4 class="tpl-ref__heading">Functions</h4>
        <For each={FUNCTIONS}>
            {(grp,) => (
                <div class="tpl-ref__group">
                    <div class="tpl-ref__group-title">{grp.group}</div>
                    <For each={grp.items}>
                        {(fn,) => (
                            <div class="tpl-ref__item">
                                <code class="tpl-ref__code">{fn.sig}</code>
                                <span class="tpl-ref__desc">{fn.desc}</span>
                            </div>
                        )}
                    </For>
                </div>
            )}
        </For>

        <A href="/admin/help/variables-and-functions" class="tpl-ref__more">
            Full reference &amp; entity schemas &rarr;
        </A>
    </div>
);

export default TemplateReference;

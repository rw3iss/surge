import { Component, createSignal, JSX, Show, } from 'solid-js';

interface CollapsiblePanelProps {
    title: string;
    subtitle?: string;
    defaultOpen?: boolean;
    children: JSX.Element;
}

/**
 * Collapsible panel with a clickable header bar.
 * Used for property sections in page/post editors.
 */
const CollapsiblePanel: Component<CollapsiblePanelProps> = (props,) => {
    const [open, setOpen,] = createSignal(props.defaultOpen ?? false,);

    return (
        <div class={`collapsible-panel ${open() ? 'collapsible-panel--open' : ''}`}>
            <button
                type="button"
                class="collapsible-panel__header"
                onClick={() => setOpen(!open(),)}
            >
                <span class="collapsible-panel__icon">{open() ? '▼' : '▶'}</span>
                <span class="collapsible-panel__title">{props.title}</span>
                <Show when={props.subtitle}>
                    <span class="collapsible-panel__subtitle">{props.subtitle}</span>
                </Show>
            </button>
            <Show when={open()}>
                <div class="collapsible-panel__body">
                    {props.children}
                </div>
            </Show>
        </div>
    );
};

export default CollapsiblePanel;

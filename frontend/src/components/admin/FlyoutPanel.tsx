import { Component, createSignal, JSX, Show, } from 'solid-js';
import './FlyoutPanel.scss';

export type FlyoutMode = 'float' | 'inline';

export interface FlyoutPanelProps {
    title: string;
    open: boolean;
    onClose: () => void;
    side?: 'left' | 'right';
    onSideChange?: (side: 'left' | 'right',) => void;
    /** 'float' = fixed overlay, 'inline' = in-page sticky column */
    mode?: FlyoutMode;
    onModeChange?: (mode: FlyoutMode,) => void;
    children: JSX.Element;
}

/**
 * A floating/docked panel that can be positioned on the left or right
 * side of the screen. Draggable header — drag past the midpoint to
 * snap to the other side. Collapsible to header-only.
 */
const FlyoutPanel: Component<FlyoutPanelProps> = (props,) => {
    const [collapsed, setCollapsed,] = createSignal(false,);
    const [dragging, setDragging,] = createSignal(false,);
    const [topOffset, setTopOffset,] = createSignal(0,);
    const side = () => props.side || 'right';
    const mode = () => props.mode || 'inline';
    const isInline = () => mode() === 'inline';

    const handleDragStart = (e: PointerEvent,) => {
        if ((e.target as HTMLElement).closest('button',)) return;
        if (isInline()) return; // no dragging in inline mode
        e.preventDefault();
        setDragging(true,);

        const startY = e.clientY;
        const startTop = topOffset();
        const startSide = side();
        const midpointX = window.innerWidth / 2;

        const handleMove = (ev: PointerEvent,) => {
            const newSide = ev.clientX < midpointX ? 'left' : 'right';
            if (newSide !== startSide && props.onSideChange) {
                props.onSideChange(newSide,);
            }
            if (collapsed()) {
                const deltaY = ev.clientY - startY;
                setTopOffset(Math.max(0, Math.min(window.innerHeight - 40, startTop + deltaY,),),);
            }
        };

        const handleUp = () => {
            setDragging(false,);
            document.removeEventListener('pointermove', handleMove,);
            document.removeEventListener('pointerup', handleUp,);
        };

        document.addEventListener('pointermove', handleMove,);
        document.addEventListener('pointerup', handleUp,);
    };

    const toggleMode = () => {
        const next: FlyoutMode = isInline() ? 'float' : 'inline';
        props.onModeChange?.(next,);
        if (next === 'inline') {
            setCollapsed(false,);
            setTopOffset(0,);
        }
    };

    return (
        <Show when={props.open}>
            <div
                class={`flyout-panel flyout-panel--${side()} ${
                    isInline() ? 'flyout-panel--inline' : ''
                } ${collapsed() ? 'flyout-panel--collapsed' : ''
                } ${dragging() ? 'flyout-panel--dragging' : ''}`}
                style={!isInline() && collapsed() ? { top: `${topOffset()}px`, } : {}}
            >
                <div
                    class="flyout-panel__header"
                    onPointerDown={!isInline() ? handleDragStart : undefined}
                >
                    <span
                        class="flyout-panel__title"
                        onClick={() => {
                            const next = !collapsed();
                            setCollapsed(next,);
                            if (!next) setTopOffset(0,);
                        }}
                    >
                        <span class="flyout-panel__collapse-icon">
                            {collapsed() ? '▶' : '▼'}
                        </span>
                        {props.title}
                    </span>
                    <div class="flyout-panel__header-actions">
                        {/* Inline / float toggle */}
                        <button
                            class={`flyout-panel__header-btn ${isInline() ? '' : 'flyout-panel__header-btn--active'}`}
                            onClick={toggleMode}
                            title={isInline() ? 'Float panel' : 'Dock in page'}
                        >
                            <svg viewBox="0 0 16 16" width="14" height="14">
                                <Show when={isInline()}>
                                    {/* "pop out" icon */}
                                    <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" fill="none" stroke-width="1.2" />
                                    <path d="M6 2v4H2M10 14v-4h4" stroke="currentColor" stroke-width="1.2" />
                                </Show>
                                <Show when={!isInline()}>
                                    {/* "dock in" icon */}
                                    <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" fill="none" stroke-width="1.2" />
                                    <path d="M10 1v14M12 5h2M12 8h2M12 11h2" stroke="currentColor" stroke-width="1.2" />
                                </Show>
                            </svg>
                        </button>
                        {/* Dock side toggle */}
                        <button
                            class="flyout-panel__header-btn"
                            onClick={() => props.onSideChange?.(side() === 'right' ? 'left' : 'right',)}
                            title={`Dock ${side() === 'right' ? 'left' : 'right'}`}
                        >
                            {side() === 'right' ? '◁' : '▷'}
                        </button>
                        <button
                            class="flyout-panel__header-btn flyout-panel__header-btn--close"
                            onClick={props.onClose}
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>
                <Show when={!collapsed()}>
                    <div class="flyout-panel__body">
                        {props.children}
                    </div>
                </Show>
            </div>
        </Show>
    );
};

export default FlyoutPanel;

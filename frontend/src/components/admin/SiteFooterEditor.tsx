import type { SiteFooterColumn, SiteFooterRow, SiteFooterSettings, SiteLayoutItem, SiteLayoutItemType, } from '@rw/shared';
import { Component, createEffect, createSignal, For, onMount, Show, } from 'solid-js';
import { fetchSiteFooter, saveSiteFooter, } from '../../services/api';
import { colorCssValue, } from '../../services/colorResolver';
import ColorPicker from './ColorPicker';
import Tooltip from './Tooltip';
import { useToast, } from '../Toast';
import './SiteFooterEditor.scss';

/**
 * Site Footer editor.
 *
 * Hierarchy: Rows → Columns → Items. The user picks one of three
 * editing modes by clicking on the corresponding element in either
 * the structure tree (left rail) or the live preview (top). Each
 * level has a focused settings panel underneath so the field set
 * stays small and learnable.
 *
 * Persistence: a single `site_footer` row in `site_settings` holds
 * the entire structure as JSON. Saves are explicit (Save button)
 * rather than auto-save so the operator can experiment without
 * partial commits going live.
 *
 * The renderer in Layout/Footer.tsx is reused for the live preview
 * so what they see here is exactly what visitors will see.
 */

const genId = (prefix: string,) => `${prefix}-${Date.now()}-${Math.random().toString(36,).slice(2, 7,)}`;

const ITEM_TYPES: { value: SiteLayoutItemType; label: string; }[] = [
    { value: 'text', label: 'Text', },
    { value: 'text_link', label: 'Text Link', },
    { value: 'image', label: 'Image', },
    { value: 'image_link', label: 'Image Link', },
    { value: 'button', label: 'Button', },
    { value: 'gap', label: 'Gap', },
    { value: 'flex_spacer', label: 'Flex Spacer', },
];

const ALIGN_OPTIONS = [
    { value: 'start', label: 'Start', },
    { value: 'center', label: 'Center', },
    { value: 'end', label: 'End', },
    { value: 'space-between', label: 'Space Between', },
    { value: 'space-around', label: 'Space Around', },
] as const;

const VALIGN_OPTIONS = [
    { value: 'start', label: 'Start', },
    { value: 'center', label: 'Center', },
    { value: 'end', label: 'End', },
    { value: 'stretch', label: 'Stretch', },
] as const;

// ─── Defaults ─────────────────────────────────────────────────────

function newItem(): SiteLayoutItem {
    return {
        id: genId('itm',),
        type: 'text_link',
        text: 'New link',
        url: '/',
        order: 0,
    };
}

function newColumn(): SiteFooterColumn {
    return {
        id: genId('col',),
        flex: 1,
        direction: 'column',
        gap: '8px',
        alignment: 'start',
        verticalAlignment: 'stretch',
        items: [],
    };
}

function newRow(): SiteFooterRow {
    return {
        id: genId('row',),
        useGutter: true,
        gap: '24px',
        padding: '24px 0',
        columns: [newColumn(),],
    };
}

// ─── Selection model ──────────────────────────────────────────────

type Selection =
    | { kind: 'none'; }
    | { kind: 'row'; rowId: string; }
    | { kind: 'column'; rowId: string; columnId: string; }
    | { kind: 'item'; rowId: string; columnId: string; itemId: string; };

// ─── Editor ───────────────────────────────────────────────────────

/** Auto-append 'px' if value is a bare integer (e.g. "10" → "10px"). */
function normalizeCssValue(val: string,): string {
    const trimmed = val.trim();
    if (!trimmed) return trimmed;
    if (/^\d+$/.test(trimmed,)) return `${trimmed}px`;
    return trimmed;
}

const SiteFooterEditor: Component = () => {
    const toast = useToast();
    const [settings, setSettings,] = createSignal<SiteFooterSettings>({ enabled: false, rows: [], },);
    const [selection, setSelection,] = createSignal<Selection>({ kind: 'none', },);
    const [saving, setSaving,] = createSignal(false,);
    const [loaded, setLoaded,] = createSignal(false,);
    const [dirty, setDirty,] = createSignal(false,);
    // General footer-level settings (background / padding / margin)
    // are collapsed behind this disclosure to keep the section header
    // tight when an operator just wants to edit rows. Same pattern as
    // SiteHeaderEditor's Settings link.
    const [showSettings, setShowSettings,] = createSignal(false,);

    onMount(async () => {
        const r = await fetchSiteFooter();
        if (r.success && r.data) {
            setSettings(r.data as SiteFooterSettings,);
        }
        setLoaded(true,);
    },);

    // Mark dirty whenever the settings object changes after first load.
    createEffect(() => {
        // Read settings() to subscribe — body of effect runs on changes.
        settings();
        if (loaded()) setDirty(true,);
    },);

    const update = (mutator: (s: SiteFooterSettings,) => SiteFooterSettings,) => {
        setSettings((current,) => mutator(structuredClone(current,),),);
    };

    // ── Row mutations ─────────────────────────────────────────────

    const addRow = () => {
        const row = newRow();
        update((s,) => { s.rows.push(row,); return s; },);
        setSelection({ kind: 'row', rowId: row.id, },);
    };

    const removeRow = (rowId: string,) => {
        update((s,) => { s.rows = s.rows.filter((r,) => r.id !== rowId,); return s; },);
        setSelection({ kind: 'none', },);
    };

    const moveRow = (rowId: string, dir: -1 | 1,) => {
        update((s,) => {
            const idx = s.rows.findIndex((r,) => r.id === rowId,);
            if (idx < 0) return s;
            const target = idx + dir;
            if (target < 0 || target >= s.rows.length) return s;
            [s.rows[idx], s.rows[target],] = [s.rows[target], s.rows[idx],];
            return s;
        },);
    };

    const updateRow = (rowId: string, patch: Partial<SiteFooterRow>,) => {
        update((s,) => {
            const r = s.rows.find((x,) => x.id === rowId,);
            if (r) Object.assign(r, patch,);
            return s;
        },);
    };

    // ── Column mutations ──────────────────────────────────────────

    const addColumn = (rowId: string,) => {
        const col = newColumn();
        update((s,) => {
            const r = s.rows.find((x,) => x.id === rowId,);
            if (r) r.columns.push(col,);
            return s;
        },);
        setSelection({ kind: 'column', rowId, columnId: col.id, },);
    };

    const removeColumn = (rowId: string, columnId: string,) => {
        update((s,) => {
            const r = s.rows.find((x,) => x.id === rowId,);
            if (r) r.columns = r.columns.filter((c,) => c.id !== columnId,);
            return s;
        },);
        setSelection({ kind: 'row', rowId, },);
    };

    const moveColumn = (rowId: string, columnId: string, dir: -1 | 1,) => {
        update((s,) => {
            const r = s.rows.find((x,) => x.id === rowId,);
            if (!r) return s;
            const idx = r.columns.findIndex((c,) => c.id === columnId,);
            if (idx < 0) return s;
            const target = idx + dir;
            if (target < 0 || target >= r.columns.length) return s;
            [r.columns[idx], r.columns[target],] = [r.columns[target], r.columns[idx],];
            return s;
        },);
    };

    const updateColumn = (rowId: string, columnId: string, patch: Partial<SiteFooterColumn>,) => {
        update((s,) => {
            const c = s.rows.find((x,) => x.id === rowId,)?.columns.find((y,) => y.id === columnId,);
            if (c) Object.assign(c, patch,);
            return s;
        },);
    };

    // ── Item mutations ────────────────────────────────────────────

    const addItem = (rowId: string, columnId: string,) => {
        const item = newItem();
        update((s,) => {
            const c = s.rows.find((x,) => x.id === rowId,)?.columns.find((y,) => y.id === columnId,);
            if (!c) return s;
            item.order = c.items.length;
            c.items.push(item,);
            return s;
        },);
        setSelection({ kind: 'item', rowId, columnId, itemId: item.id, },);
    };

    const removeItem = (rowId: string, columnId: string, itemId: string,) => {
        update((s,) => {
            const c = s.rows.find((x,) => x.id === rowId,)?.columns.find((y,) => y.id === columnId,);
            if (c) c.items = c.items.filter((i,) => i.id !== itemId,);
            return s;
        },);
        setSelection({ kind: 'column', rowId, columnId, },);
    };

    const moveItem = (rowId: string, columnId: string, itemId: string, dir: -1 | 1,) => {
        update((s,) => {
            const c = s.rows.find((x,) => x.id === rowId,)?.columns.find((y,) => y.id === columnId,);
            if (!c) return s;
            const idx = c.items.findIndex((i,) => i.id === itemId,);
            if (idx < 0) return s;
            const target = idx + dir;
            if (target < 0 || target >= c.items.length) return s;
            [c.items[idx], c.items[target],] = [c.items[target], c.items[idx],];
            // Re-stamp order so the renderer's sort is stable.
            c.items.forEach((item, i,) => { item.order = i; },);
            return s;
        },);
    };

    const updateItem = (rowId: string, columnId: string, itemId: string, patch: Partial<SiteLayoutItem>,) => {
        update((s,) => {
            const c = s.rows.find((x,) => x.id === rowId,)?.columns.find((y,) => y.id === columnId,);
            if (!c) return s;
            const it = c.items.find((i,) => i.id === itemId,);
            if (it) Object.assign(it, patch,);
            return s;
        },);
    };

    // ── Save ──────────────────────────────────────────────────────

    const save = async () => {
        setSaving(true,);
        try {
            const r = await saveSiteFooter(settings(),);
            if (r.success) {
                toast.success('Footer saved',);
                setDirty(false,);
            } else {
                toast.error(r.error?.message || 'Save failed',);
            }
        } finally {
            setSaving(false,);
        }
    };

    // ── Selected lookups (helpers for the panels) ─────────────────

    const selectedRow = (): SiteFooterRow | null => {
        const sel = selection();
        if (sel.kind === 'none') return null;
        return settings().rows.find((r,) => r.id === sel.rowId,) ?? null;
    };
    const selectedColumn = (): SiteFooterColumn | null => {
        const sel = selection();
        if (sel.kind !== 'column' && sel.kind !== 'item') return null;
        return selectedRow()?.columns.find((c,) => c.id === sel.columnId,) ?? null;
    };
    const selectedItem = (): SiteLayoutItem | null => {
        const sel = selection();
        if (sel.kind !== 'item') return null;
        return selectedColumn()?.items.find((i,) => i.id === sel.itemId,) ?? null;
    };

    // ── Render ────────────────────────────────────────────────────

    return (
        <div class="footer-editor">
            <Show when={loaded()} fallback={<p>Loading…</p>}>
                {/* Top bar: enable toggle + save */}
                <div class="footer-editor__topbar">
                    <label class="footer-editor__enable">
                        <input
                            type="checkbox"
                            checked={settings().enabled}
                            onChange={(e,) => update((s,) => { s.enabled = e.currentTarget.checked; return s; },)}
                        />
                        <span class="footer-editor__enable-label">Enable site footer</span>
                    </label>
                    <div class="footer-editor__topbar-spacer" />
                    <Show when={dirty()}>
                        <span class="footer-editor__dirty">Unsaved changes</span>
                    </Show>
                    <button
                        type="button"
                        class="footer-editor__save"
                        onClick={save}
                        disabled={saving() || !dirty()}
                    >
                        {saving() ? 'Saving…' : 'Save footer'}
                    </button>
                </div>

                {/* General footer settings — collapsed disclosure. Background,
                    padding, and margin live here rather than at the row level
                    because they apply to the entire footer wrapper. Mirrors
                    the SiteHeaderEditor's "Settings" disclosure. */}
                <Show when={settings().enabled}>
                    <div class="footer-editor__general-settings-row">
                        <button
                            type="button"
                            class="footer-editor__general-settings-toggle"
                            onClick={() => setShowSettings(!showSettings(),)}
                        >
                            <span class="footer-editor__general-settings-chevron" aria-hidden="true">
                                {showSettings() ? '▼' : '▶'}
                            </span>
                            {showSettings() ? 'Hide footer settings' : 'Footer settings'}
                        </button>
                    </div>

                    <Show when={showSettings()}>
                        <FooterGeneralSettings
                            background={settings().backgroundColor ?? ''}
                            padding={settings().padding ?? ''}
                            margin={settings().margin ?? ''}
                            onBackgroundChange={(v,) => update((s,) => { s.backgroundColor = v || undefined; return s; },)}
                            onPaddingChange={(v,) => update((s,) => { s.padding = v || undefined; return s; },)}
                            onMarginChange={(v,) => update((s,) => { s.margin = v || undefined; return s; },)}
                        />
                    </Show>
                </Show>

                {/* The whole editor body is gated on the enable toggle —
                    when disabled, the operator sees just the toggle and
                    a one-line explanation, not 800 pixels of disabled UI. */}
                <Show
                    when={settings().enabled}
                    fallback={
                        <p class="footer-editor__disabled-note">
                            The site footer is disabled. Enable it above to start designing it. Until then,
                            no footer is rendered on the public site.
                        </p>
                    }
                >
                    <PreviewBlock
                        settings={settings()}
                        selection={selection()}
                        onSelect={setSelection}
                    />

                    <div class="footer-editor__body">
                        {/* Left rail: structure tree */}
                        <aside class="footer-editor__tree">
                            <div class="footer-editor__tree-head">
                                <span>Rows</span>
                                <button type="button" onClick={addRow}>+ Add row</button>
                            </div>
                            <Show when={settings().rows.length === 0}>
                                <p class="footer-editor__empty">No rows yet. Click "Add row" to begin.</p>
                            </Show>
                            <For each={settings().rows}>
                                {(row, rowIdx,) => (
                                    <RowTreeItem
                                        row={row}
                                        rowIndex={rowIdx()}
                                        rowCount={settings().rows.length}
                                        selection={selection()}
                                        onSelect={setSelection}
                                        onAddColumn={() => addColumn(row.id,)}
                                        onAddItem={(columnId,) => addItem(row.id, columnId,)}
                                        onMoveRow={(dir,) => moveRow(row.id, dir,)}
                                        onMoveColumn={(columnId, dir,) => moveColumn(row.id, columnId, dir,)}
                                        onMoveItem={(columnId, itemId, dir,) => moveItem(row.id, columnId, itemId, dir,)}
                                        onRemoveRow={() => removeRow(row.id,)}
                                        onRemoveColumn={(columnId,) => removeColumn(row.id, columnId,)}
                                        onRemoveItem={(columnId, itemId,) => removeItem(row.id, columnId, itemId,)}
                                    />
                                )}
                            </For>
                        </aside>

                        {/* Right pane: contextual settings panel */}
                        <section class="footer-editor__panel">
                            <Show when={selection().kind === 'none'}>
                                <p class="footer-editor__hint">
                                    Select a row, column, or item from the left to edit it. The preview above updates in
                                    real time.
                                </p>
                            </Show>

                            <Show when={selectedItem()}>
                                {(item) => (
                                    <ItemPanel
                                        item={item()}
                                        onChange={(patch) => {
                                            const sel = selection();
                                            if (sel.kind === 'item') updateItem(sel.rowId, sel.columnId, sel.itemId, patch,);
                                        }}
                                    />
                                )}
                            </Show>

                            <Show when={!selectedItem() && selectedColumn()}>
                                {(column) => (
                                    <ColumnPanel
                                        column={column()}
                                        onChange={(patch) => {
                                            const sel = selection();
                                            const rowId = sel.kind === 'column' ? sel.rowId : sel.kind === 'item' ? sel.rowId : '';
                                            const columnId = sel.kind === 'column' ? sel.columnId : sel.kind === 'item' ? sel.columnId : '';
                                            if (rowId && columnId) updateColumn(rowId, columnId, patch,);
                                        }}
                                    />
                                )}
                            </Show>

                            <Show when={!selectedColumn() && selectedRow()}>
                                {(row) => (
                                    <RowPanel
                                        row={row()}
                                        onChange={(patch) => {
                                            const sel = selection();
                                            if (sel.kind === 'row') updateRow(sel.rowId, patch,);
                                        }}
                                    />
                                )}
                            </Show>
                        </section>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

// ─── Live preview ─────────────────────────────────────────────────
//
// The preview IS the public footer renderer — but every row, column,
// and item is wrapped in a clickable shell that gets a colored outline
// when selected. There is NO separate absolute-positioned overlay.
//
// Why: the previous overlay-on-top approach drifted because its
// flexbox math, padding, and item sizes never perfectly matched the
// real renderer's layout (gutter, content-driven item sizes, etc.).
// Using a single integrated tree means the selection rings sit on
// the actual elements and align by definition.
//
// The duplication of rendering rules with `Layout/Footer.tsx` is
// deliberate — the editor's preview has different concerns (clickable,
// outlineable, never collapsing to zero-size) than the public render,
// so a shared abstraction would just create a worse version of both.

function PreviewBlock(props: {
    settings: SiteFooterSettings;
    selection: Selection;
    onSelect: (s: Selection,) => void;
},) {
    // Mirror the public renderer's outer styles so the preview shows
    // the configured background / padding / margin exactly. Any of
    // these falling through to undefined keeps the SCSS default.
    const previewStyle = () => {
        const s: Record<string, string> = {};
        const bg = colorCssValue(props.settings.backgroundColor, '',);
        if (bg) s['background-color'] = bg;
        if (props.settings.padding) s['padding'] = props.settings.padding;
        if (props.settings.margin) s['margin'] = props.settings.margin;
        return s;
    };
    return (
        <div class="footer-editor__preview-wrap">
            <div class="footer-editor__preview-label">Preview</div>
            <div class="footer-editor__preview" style={previewStyle()}>
                <Show
                    when={props.settings.rows.length > 0}
                    fallback={
                        <div class="footer-editor__preview-empty">
                            Add a row to start designing the footer.
                        </div>
                    }
                >
                    <For each={props.settings.rows}>
                        {(row,) => (
                            <EditableRow
                                row={row}
                                selection={props.selection}
                                onSelect={props.onSelect}
                            />
                        )}
                    </For>
                </Show>
            </div>
        </div>
    );
}

function EditableRow(props: {
    row: SiteFooterRow;
    selection: Selection;
    onSelect: (s: Selection,) => void;
},) {
    const r = () => props.row;
    const isSelected = () =>
        props.selection.kind !== 'none' && props.selection.rowId === r().id;

    const outerStyle = () => {
        const s: Record<string, string> = {};
        const bg = colorCssValue(r().backgroundColor, '',);
        if (bg) s['background-color'] = bg;
        if (r().padding) s['padding'] = r().padding!;
        if (r().margin) s['margin'] = r().margin!;
        return s;
    };

    const innerStyle = () => {
        const s: Record<string, string> = {
            display: 'flex',
            'flex-direction': 'row',
            'align-items': 'stretch',
            width: '100%',
        };
        if (r().gap) s['gap'] = r().gap!;
        if (r().useGutter) {
            s['max-width'] = '1200px';
            s['margin'] = '0 auto';
            s['padding-left'] = '16px';
            s['padding-right'] = '16px';
        }
        return s;
    };

    return (
        <div
            class={`footer-editor__pv-row ${isSelected() ? 'is-selected' : ''}`}
            style={outerStyle()}
            onClick={(e,) => { e.stopPropagation(); props.onSelect({ kind: 'row', rowId: r().id, },); }}
        >
            <div class="footer-editor__pv-row-inner" style={innerStyle()}>
                <For each={r().columns}>
                    {(column,) => (
                        <EditableColumn
                            row={r()}
                            column={column}
                            selection={props.selection}
                            onSelect={props.onSelect}
                        />
                    )}
                </For>
            </div>
        </div>
    );
}

function EditableColumn(props: {
    row: SiteFooterRow;
    column: SiteFooterColumn;
    selection: Selection;
    onSelect: (s: Selection,) => void;
},) {
    const c = () => props.column;
    const isSelected = () =>
        (props.selection.kind === 'column' || props.selection.kind === 'item')
        && props.selection.rowId === props.row.id
        && props.selection.columnId === c().id;

    const direction = () => c().direction === 'row' ? 'row' : 'column';
    const justify = () => {
        const a = c().alignment ?? 'start';
        return a === 'start' ? 'flex-start' : a === 'end' ? 'flex-end' : a;
    };
    const align = () => {
        const a = c().verticalAlignment ?? (direction() === 'column' ? 'start' : 'center');
        return a === 'start' ? 'flex-start' : a === 'end' ? 'flex-end' : a;
    };

    const style = () => {
        const s: Record<string, string> = {
            display: 'flex',
            'flex-direction': direction(),
            'justify-content': justify(),
            'align-items': align(),
            'flex-grow': String(c().flex ?? 1,),
            'flex-basis': '0',
            'min-width': '0',
        };
        if (c().gap) s['gap'] = c().gap!;
        if (c().padding) s['padding'] = c().padding!;
        if (c().margin) s['margin'] = c().margin!;
        return s;
    };

    const items = () => [...c().items,].sort((a, b,) => (a.order ?? 0) - (b.order ?? 0));

    return (
        <div
            class={`footer-editor__pv-col ${isSelected() ? 'is-selected' : ''}`}
            style={style()}
            onClick={(e,) => { e.stopPropagation(); props.onSelect({ kind: 'column', rowId: props.row.id, columnId: c().id, },); }}
        >
            <Show when={items().length === 0}>
                <span class="footer-editor__pv-col-empty">(empty column)</span>
            </Show>
            <For each={items()}>
                {(item,) => (
                    <EditableItem
                        row={props.row}
                        column={c()}
                        item={item}
                        selection={props.selection}
                        onSelect={props.onSelect}
                    />
                )}
            </For>
        </div>
    );
}

function EditableItem(props: {
    row: SiteFooterRow;
    column: SiteFooterColumn;
    item: SiteLayoutItem;
    selection: Selection;
    onSelect: (s: Selection,) => void;
},) {
    const it = () => props.item;
    const isSelected = () =>
        props.selection.kind === 'item'
        && props.selection.rowId === props.row.id
        && props.selection.columnId === props.column.id
        && props.selection.itemId === it().id;

    const baseStyle = () => {
        const s: Record<string, string> = {};
        if (it().fontSize) s['font-size'] = it().fontSize!;
        if (it().fontWeight) s['font-weight'] = it().fontWeight!;
        const tc = colorCssValue(it().textColor, '',);
        if (tc) s['color'] = tc;
        if (it().width) s['width'] = it().width!;
        if (it().margin) s['margin'] = it().margin!;
        if (it().padding) s['padding'] = it().padding!;
        if (it().alignment) s['text-align'] = it().alignment!;
        return s;
    };

    // Render the actual item content. We use real anchors / images / text
    // so it visually matches the public output, but with `pointer-events:
    // none` on inner elements so clicks always hit the wrapper.
    const renderContent = () => {
        switch (it().type) {
            case 'image':
                return <img src={it().imageUrl} alt="" style={baseStyle()} class="footer__item-img" />;
            case 'image_link':
                return (
                    <span style={baseStyle()} class="footer__item-img-link">
                        <img src={it().imageUrl} alt={it().text || ''} />
                    </span>
                );
            case 'text':
                return <span style={baseStyle()} class="footer__item-text">{it().text}</span>;
            case 'text_link':
                return <span style={baseStyle()} class="footer__item-link">{it().text}</span>;
            case 'button':
                return (
                    <span
                        style={{
                            ...baseStyle(),
                            'background-color': colorCssValue(it().buttonColor, '#e63946',),
                            color: colorCssValue(it().textColor, '#fff',),
                        }}
                        class="footer__item-button"
                    >
                        {it().text}
                    </span>
                );
            case 'gap':
                return <span class="footer__item-gap" style={{ width: it().width || '12px', }} />;
            case 'flex_spacer':
                return <span class="footer__item-flex-spacer" />;
            case 'menu':
                return null;
        }
    };

    return (
        <span
            class={`footer-editor__pv-item ${isSelected() ? 'is-selected' : ''}`}
            onClick={(e,) => { e.stopPropagation(); props.onSelect({ kind: 'item', rowId: props.row.id, columnId: props.column.id, itemId: it().id, },); }}
        >
            {renderContent()}
        </span>
    );
}

// ─── Tree (left rail) ─────────────────────────────────────────────

function RowTreeItem(props: {
    row: SiteFooterRow;
    rowIndex: number;
    rowCount: number;
    selection: Selection;
    onSelect: (s: Selection,) => void;
    onAddColumn: () => void;
    onAddItem: (columnId: string,) => void;
    onMoveRow: (dir: -1 | 1,) => void;
    onMoveColumn: (columnId: string, dir: -1 | 1,) => void;
    onMoveItem: (columnId: string, itemId: string, dir: -1 | 1,) => void;
    onRemoveRow: () => void;
    onRemoveColumn: (columnId: string,) => void;
    onRemoveItem: (columnId: string, itemId: string,) => void;
},) {
    const rowSelected = () =>
        props.selection.kind !== 'none' && props.selection.rowId === props.row.id;

    return (
        <div class={`footer-editor__tree-row ${rowSelected() ? 'is-selected' : ''}`}>
            <div class="footer-editor__tree-row-head">
                <button
                    type="button"
                    class="footer-editor__tree-label"
                    onClick={() => props.onSelect({ kind: 'row', rowId: props.row.id, },)}
                >
                    Row {props.rowIndex + 1}
                </button>
                <span class="footer-editor__tree-actions">
                    <button type="button" disabled={props.rowIndex === 0} onClick={() => props.onMoveRow(-1,)} title="Move up">↑</button>
                    <button type="button" disabled={props.rowIndex >= props.rowCount - 1} onClick={() => props.onMoveRow(1,)} title="Move down">↓</button>
                    <button type="button" onClick={props.onRemoveRow} title="Delete row" class="is-danger">×</button>
                </span>
            </div>
            <div class="footer-editor__tree-cols">
                <For each={props.row.columns}>
                    {(col, colIdx,) => (
                        <ColumnTreeItem
                            row={props.row}
                            column={col}
                            colIndex={colIdx()}
                            colCount={props.row.columns.length}
                            selection={props.selection}
                            onSelect={props.onSelect}
                            onAddItem={() => props.onAddItem(col.id,)}
                            onMoveColumn={(dir,) => props.onMoveColumn(col.id, dir,)}
                            onMoveItem={(itemId, dir,) => props.onMoveItem(col.id, itemId, dir,)}
                            onRemoveColumn={() => props.onRemoveColumn(col.id,)}
                            onRemoveItem={(itemId,) => props.onRemoveItem(col.id, itemId,)}
                        />
                    )}
                </For>
                <button type="button" class="footer-editor__add-col" onClick={props.onAddColumn}>
                    + Add column
                </button>
            </div>
        </div>
    );
}

function ColumnTreeItem(props: {
    row: SiteFooterRow;
    column: SiteFooterColumn;
    colIndex: number;
    colCount: number;
    selection: Selection;
    onSelect: (s: Selection,) => void;
    onAddItem: () => void;
    onMoveColumn: (dir: -1 | 1,) => void;
    onMoveItem: (itemId: string, dir: -1 | 1,) => void;
    onRemoveColumn: () => void;
    onRemoveItem: (itemId: string,) => void;
},) {
    const colSelected = () =>
        (props.selection.kind === 'column' || props.selection.kind === 'item')
        && props.selection.rowId === props.row.id
        && props.selection.columnId === props.column.id;

    return (
        <div class={`footer-editor__tree-col ${colSelected() ? 'is-selected' : ''}`}>
            <div class="footer-editor__tree-col-head">
                <button
                    type="button"
                    class="footer-editor__tree-label"
                    onClick={() => props.onSelect({ kind: 'column', rowId: props.row.id, columnId: props.column.id, },)}
                >
                    Column {props.colIndex + 1} <span class="footer-editor__tree-meta">flex: {props.column.flex ?? 1}</span>
                </button>
                <span class="footer-editor__tree-actions">
                    <button type="button" disabled={props.colIndex === 0} onClick={() => props.onMoveColumn(-1,)} title="Move left">←</button>
                    <button type="button" disabled={props.colIndex >= props.colCount - 1} onClick={() => props.onMoveColumn(1,)} title="Move right">→</button>
                    <button type="button" onClick={props.onRemoveColumn} title="Delete column" class="is-danger">×</button>
                </span>
            </div>
            <div class="footer-editor__tree-items">
                <For each={props.column.items}>
                    {(item, itemIdx,) => (
                        <ItemTreeItem
                            row={props.row}
                            column={props.column}
                            item={item}
                            itemIndex={itemIdx()}
                            itemCount={props.column.items.length}
                            selection={props.selection}
                            onSelect={props.onSelect}
                            onMove={(dir,) => props.onMoveItem(item.id, dir,)}
                            onRemove={() => props.onRemoveItem(item.id,)}
                        />
                    )}
                </For>
                <button type="button" class="footer-editor__add-item" onClick={props.onAddItem}>
                    + Add item
                </button>
            </div>
        </div>
    );
}

function ItemTreeItem(props: {
    row: SiteFooterRow;
    column: SiteFooterColumn;
    item: SiteLayoutItem;
    itemIndex: number;
    itemCount: number;
    selection: Selection;
    onSelect: (s: Selection,) => void;
    onMove: (dir: -1 | 1,) => void;
    onRemove: () => void;
},) {
    const itemSelected = () =>
        props.selection.kind === 'item'
        && props.selection.rowId === props.row.id
        && props.selection.columnId === props.column.id
        && props.selection.itemId === props.item.id;

    const label = () => {
        const t = props.item.type;
        if (t === 'gap' || t === 'flex_spacer') return t;
        return props.item.text || `(${t})`;
    };

    return (
        <div class={`footer-editor__tree-item ${itemSelected() ? 'is-selected' : ''}`}>
            <button
                type="button"
                class="footer-editor__tree-label"
                onClick={() => props.onSelect({ kind: 'item', rowId: props.row.id, columnId: props.column.id, itemId: props.item.id, },)}
            >
                <span class="footer-editor__tree-meta">{props.item.type}</span> {label()}
            </button>
            <span class="footer-editor__tree-actions">
                <button type="button" disabled={props.itemIndex === 0} onClick={() => props.onMove(-1,)} title="Move up">↑</button>
                <button type="button" disabled={props.itemIndex >= props.itemCount - 1} onClick={() => props.onMove(1,)} title="Move down">↓</button>
                <button type="button" onClick={props.onRemove} title="Delete item" class="is-danger">×</button>
            </span>
        </div>
    );
}

// ─── Settings panels ──────────────────────────────────────────────

/**
 * General footer-level settings: background color, padding, margin.
 * These map to the top-level `SiteFooterSettings` fields and are
 * applied to the outer `<footer>` element by the renderer (and by
 * the editor's preview, since it shares the same renderer).
 *
 * Padding/margin accept any valid CSS value (e.g. `12px 0`, `1rem`,
 * `0 auto`). A bare integer is auto-suffixed to `px` on blur, matching
 * the SiteHeaderEditor's behavior.
 */
function FooterGeneralSettings(props: {
    background: string;
    padding: string;
    margin: string;
    onBackgroundChange: (value: string,) => void;
    onPaddingChange: (value: string,) => void;
    onMarginChange: (value: string,) => void;
},) {
    return (
        <div class="footer-editor__general-settings">
            <div class="footer-editor__general-field">
                <label class="footer-editor__general-label">Background</label>
                <ColorPicker
                    value={props.background}
                    onChange={(hex,) => props.onBackgroundChange(hex,)}
                    clearable
                    onClear={() => props.onBackgroundChange('',)}
                />
            </div>
            <div class="footer-editor__general-field">
                <label class="footer-editor__general-label">Padding</label>
                <input
                    type="text"
                    class="footer-editor__general-input"
                    value={props.padding}
                    placeholder="0px"
                    onInput={(e,) => props.onPaddingChange(e.currentTarget.value,)}
                    onBlur={(e,) => {
                        const v = normalizeCssValue(e.currentTarget.value,);
                        props.onPaddingChange(v,);
                        e.currentTarget.value = v;
                    }}
                />
                <Tooltip
                    content="Valid CSS values: px, em, rem, vw, %, or shorthand like '8px 16px'. Plain numbers will auto-append px."
                    header="Padding"
                />
            </div>
            <div class="footer-editor__general-field">
                <label class="footer-editor__general-label">Margin</label>
                <input
                    type="text"
                    class="footer-editor__general-input"
                    value={props.margin}
                    placeholder="0px"
                    onInput={(e,) => props.onMarginChange(e.currentTarget.value,)}
                    onBlur={(e,) => {
                        const v = normalizeCssValue(e.currentTarget.value,);
                        props.onMarginChange(v,);
                        e.currentTarget.value = v;
                    }}
                />
                <Tooltip
                    content="Valid CSS values: px, em, rem, vw, %, auto, or shorthand like '0 auto'. Plain numbers will auto-append px."
                    header="Margin"
                />
            </div>
        </div>
    );
}

function RowPanel(props: { row: SiteFooterRow; onChange: (p: Partial<SiteFooterRow>,) => void; },) {
    return (
        <div class="footer-editor__form">
            <h3>Row settings</h3>
            <label class="footer-editor__field">
                <span>Inherit site gutter (constrains row to container width)</span>
                <input
                    type="checkbox"
                    checked={Boolean(props.row.useGutter,)}
                    onChange={(e,) => props.onChange({ useGutter: e.currentTarget.checked, },)}
                />
            </label>
            <label class="footer-editor__field">
                <span>Gap between columns</span>
                <input
                    type="text"
                    value={props.row.gap ?? ''}
                    placeholder="e.g. 24px"
                    onInput={(e,) => props.onChange({ gap: e.currentTarget.value, },)}
                />
            </label>
            <label class="footer-editor__field">
                <span>Padding</span>
                <input
                    type="text"
                    value={props.row.padding ?? ''}
                    placeholder="e.g. 24px 0"
                    onInput={(e,) => props.onChange({ padding: e.currentTarget.value, },)}
                />
            </label>
            <label class="footer-editor__field">
                <span>Margin</span>
                <input
                    type="text"
                    value={props.row.margin ?? ''}
                    placeholder="e.g. 0"
                    onInput={(e,) => props.onChange({ margin: e.currentTarget.value, },)}
                />
            </label>
            <label class="footer-editor__field">
                <span>Background color</span>
                <input
                    type="text"
                    value={props.row.backgroundColor ?? ''}
                    placeholder="e.g. #1d3557"
                    onInput={(e,) => props.onChange({ backgroundColor: e.currentTarget.value, },)}
                />
            </label>
        </div>
    );
}

function ColumnPanel(props: { column: SiteFooterColumn; onChange: (p: Partial<SiteFooterColumn>,) => void; },) {
    return (
        <div class="footer-editor__form">
            <h3>Column settings</h3>
            <label class="footer-editor__field">
                <span>Layout direction</span>
                <select
                    value={props.column.direction ?? 'column'}
                    onChange={(e,) => props.onChange({ direction: e.currentTarget.value as 'row' | 'column', },)}
                >
                    <option value="column">Vertical (column)</option>
                    <option value="row">Horizontal (row)</option>
                </select>
            </label>
            <label class="footer-editor__field">
                <span>Flex size (proportion of row width)</span>
                <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={props.column.flex ?? 1}
                    onInput={(e,) => props.onChange({ flex: Number(e.currentTarget.value,) || 1, },)}
                />
            </label>
            <label class="footer-editor__field">
                <span>Item alignment (main axis)</span>
                <select
                    value={props.column.alignment ?? 'start'}
                    onChange={(e,) => props.onChange({ alignment: e.currentTarget.value as SiteFooterColumn['alignment'], },)}
                >
                    <For each={ALIGN_OPTIONS}>{(opt,) => <option value={opt.value}>{opt.label}</option>}</For>
                </select>
            </label>
            <label class="footer-editor__field">
                <span>Item alignment (cross axis)</span>
                <select
                    value={props.column.verticalAlignment ?? 'stretch'}
                    onChange={(e,) => props.onChange({ verticalAlignment: e.currentTarget.value as SiteFooterColumn['verticalAlignment'], },)}
                >
                    <For each={VALIGN_OPTIONS}>{(opt,) => <option value={opt.value}>{opt.label}</option>}</For>
                </select>
            </label>
            <label class="footer-editor__field">
                <span>Gap between items</span>
                <input
                    type="text"
                    value={props.column.gap ?? ''}
                    placeholder="e.g. 8px"
                    onInput={(e,) => props.onChange({ gap: e.currentTarget.value, },)}
                />
            </label>
            <label class="footer-editor__field">
                <span>Padding</span>
                <input
                    type="text"
                    value={props.column.padding ?? ''}
                    placeholder="e.g. 8px"
                    onInput={(e,) => props.onChange({ padding: e.currentTarget.value, },)}
                />
            </label>
            <label class="footer-editor__field">
                <span>Margin</span>
                <input
                    type="text"
                    value={props.column.margin ?? ''}
                    placeholder="e.g. 0"
                    onInput={(e,) => props.onChange({ margin: e.currentTarget.value, },)}
                />
            </label>
        </div>
    );
}

function ItemPanel(props: { item: SiteLayoutItem; onChange: (p: Partial<SiteLayoutItem>,) => void; },) {
    const t = () => props.item.type;
    const supportsText = () => ['text', 'text_link', 'button',].includes(t(),);
    const supportsUrl = () => ['text_link', 'image_link', 'button',].includes(t(),);
    const supportsImage = () => ['image', 'image_link',].includes(t(),);
    const supportsTypography = () => ['text', 'text_link', 'button',].includes(t(),);

    return (
        <div class="footer-editor__form">
            <h3>Item settings</h3>
            <label class="footer-editor__field">
                <span>Type</span>
                <select
                    value={t()}
                    onChange={(e,) => props.onChange({ type: e.currentTarget.value as SiteLayoutItemType, },)}
                >
                    <For each={ITEM_TYPES}>{(opt,) => <option value={opt.value}>{opt.label}</option>}</For>
                </select>
            </label>

            <Show when={supportsText()}>
                <label class="footer-editor__field">
                    <span>Text</span>
                    <input
                        type="text"
                        value={props.item.text ?? ''}
                        onInput={(e,) => props.onChange({ text: e.currentTarget.value, },)}
                    />
                </label>
            </Show>

            <Show when={supportsUrl()}>
                <label class="footer-editor__field">
                    <span>URL</span>
                    <input
                        type="text"
                        value={props.item.url ?? ''}
                        placeholder="/about or https://…"
                        onInput={(e,) => props.onChange({ url: e.currentTarget.value, },)}
                    />
                </label>
                <label class="footer-editor__field footer-editor__field--inline">
                    <input
                        type="checkbox"
                        checked={Boolean(props.item.openInNewTab,)}
                        onChange={(e,) => props.onChange({ openInNewTab: e.currentTarget.checked, },)}
                    />
                    <span>Open in new tab</span>
                </label>
            </Show>

            <Show when={supportsImage()}>
                <label class="footer-editor__field">
                    <span>Image URL</span>
                    <input
                        type="text"
                        value={props.item.imageUrl ?? ''}
                        placeholder="/uploads/… or https://…"
                        onInput={(e,) => props.onChange({ imageUrl: e.currentTarget.value, },)}
                    />
                </label>
            </Show>

            <Show when={supportsTypography()}>
                <label class="footer-editor__field">
                    <span>Font size</span>
                    <input
                        type="text"
                        value={props.item.fontSize ?? ''}
                        placeholder="e.g. 14px"
                        onInput={(e,) => props.onChange({ fontSize: e.currentTarget.value, },)}
                    />
                </label>
                <label class="footer-editor__field">
                    <span>Font weight</span>
                    <select
                        value={props.item.fontWeight ?? ''}
                        onChange={(e,) => props.onChange({ fontWeight: e.currentTarget.value || undefined, },)}
                    >
                        <option value="">Default</option>
                        <option value="100">100 — Thin</option>
                        <option value="200">200 — Extra Light</option>
                        <option value="300">300 — Light</option>
                        <option value="400">400 — Regular</option>
                        <option value="500">500 — Medium</option>
                        <option value="600">600 — Semibold</option>
                        <option value="700">700 — Bold</option>
                        <option value="800">800 — Extrabold</option>
                        <option value="900">900 — Black</option>
                    </select>
                </label>
                <label class="footer-editor__field">
                    <span>Text color</span>
                    <input
                        type="text"
                        value={props.item.textColor ?? ''}
                        placeholder="e.g. #ffffff"
                        onInput={(e,) => props.onChange({ textColor: e.currentTarget.value, },)}
                    />
                </label>
            </Show>

            <Show when={t() === 'button'}>
                <label class="footer-editor__field">
                    <span>Button color</span>
                    <input
                        type="text"
                        value={props.item.buttonColor ?? ''}
                        placeholder="e.g. #e63946"
                        onInput={(e,) => props.onChange({ buttonColor: e.currentTarget.value, },)}
                    />
                </label>
            </Show>

            <Show when={t() === 'gap'}>
                <label class="footer-editor__field">
                    <span>Gap size (width)</span>
                    <input
                        type="text"
                        value={props.item.width ?? ''}
                        placeholder="e.g. 12px"
                        onInput={(e,) => props.onChange({ width: e.currentTarget.value, },)}
                    />
                </label>
            </Show>

            <label class="footer-editor__field">
                <span>Padding</span>
                <input
                    type="text"
                    value={props.item.padding ?? ''}
                    placeholder="e.g. 4px 0"
                    onInput={(e,) => props.onChange({ padding: e.currentTarget.value, },)}
                />
            </label>
            <label class="footer-editor__field">
                <span>Margin</span>
                <input
                    type="text"
                    value={props.item.margin ?? ''}
                    placeholder="e.g. 0"
                    onInput={(e,) => props.onChange({ margin: e.currentTarget.value, },)}
                />
            </label>
        </div>
    );
}

export default SiteFooterEditor;

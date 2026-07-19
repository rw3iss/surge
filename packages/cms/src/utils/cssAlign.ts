/**
 * Alignment-keyword → CSS value maps, shared across the block renderers,
 * editors, footer, and carousel. Several vocabularies exist in the codebase
 * (`start/end`, `left/right`, `top/bottom`); `toFlexAlign` normalizes them
 * all to a flexbox value so a new alignment or a fix lands in one place.
 */

/** Normalize an alignment keyword to a flexbox `align-*`/`justify-*` value. */
export function toFlexAlign(value: string | undefined | null, fallback = 'center',): string {
    switch (value) {
        case 'left':
        case 'top':
        case 'start':
        case 'flex-start':
            return 'flex-start';
        case 'right':
        case 'bottom':
        case 'end':
        case 'flex-end':
            return 'flex-end';
        case 'center':
            return 'center';
        case 'stretch':
            return 'stretch';
        // Distribution values are valid for justify-content — pass through
        // verbatim so a group's `space-*` main-axis choice isn't dropped.
        case 'space-between':
            return 'space-between';
        case 'space-around':
            return 'space-around';
        case 'space-evenly':
            return 'space-evenly';
        case 'justify':
            // Text can justify; as a flex value there's no equivalent, so pin
            // content to the start (matches prior carousel behavior).
            return 'flex-start';
        default:
            return fallback;
    }
}

/** Map a text-alignment keyword to a CSS `text-align` value. */
export const TEXT_ALIGN: Record<string, string> = {
    left: 'left',
    center: 'center',
    right: 'right',
    justify: 'justify',
};

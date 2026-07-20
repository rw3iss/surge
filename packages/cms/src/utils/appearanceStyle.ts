import type { AppearanceSettings, } from '@sitesurge/types';
import { colorCssValue, } from '../services/colorResolver';

/**
 * Resolve a font value to a CSS `font-family` string. Values are usually a
 * font `customId` from the Font manager (a bare token → gets quoted with a
 * system fallback so a missing font degrades gracefully); a legacy CSS stack
 * (contains a comma) passes through untouched. Empty → `undefined`.
 */
export function fontStack(value: string | null | undefined,): string | undefined {
    const v = (value || '').trim();
    if (!v) return undefined;
    return v.includes(',') ? v : `'${v}', system-ui, sans-serif`;
}

/**
 * Translate an `AppearanceSettings` snapshot into the inline-style
 * object that drives the `--site-*` CSS custom properties.
 *
 * Used by both `Layout.tsx` (public site) and `AdminLayout.tsx`
 * (admin chrome) so any colors/typography configured under
 * `Settings → Appearance` apply uniformly. Keeping it here avoids
 * three drifted copies of the same mapping.
 *
 * `mode: 'admin'` skips a few appearance fields that would conflict
 * with admin chrome — the admin shell needs to keep its own dark
 * sidebar and neutral background even if the public site is
 * configured with a high-contrast theme. Color tokens
 * (`--site-primary`, `--site-link`) still flow through so accent
 * styles in admin (Save buttons, focus rings, the active sidebar
 * row) match the configured brand.
 *
 * Color values may be raw hex OR `swatch:{id}` references — every
 * color is run through `colorCssValue()` so swatch refs land as
 * `var(--swatch-{id}, fallback)` and stay reactive to palette edits.
 */
export function appearanceCssVars(
    a: AppearanceSettings | null | undefined,
    mode: 'public' | 'admin' = 'public',
): Record<string, string> {
    const s: Record<string, string> = {};
    if (!a) return s;

    const setColor = (key: string, value: string | undefined,) => {
        if (!value) return;
        const css = colorCssValue(value, '',);
        if (css) s[key] = css;
    };

    // Tokens always flowed through (color & typography variables).
    setColor('--site-primary', a.primaryColor,);
    setColor('--site-button-text', a.buttonTextColor,);
    setColor('--site-link', a.linkColor,);
    setColor('--site-heading', a.headingColor,);
    setColor('--site-border', a.borderColor,);
    const headingFont = fontStack(a.headingFontFamily,);
    if (headingFont) s['--site-heading-font'] = headingFont;
    if (a.headingWeight) s['--site-heading-weight'] = a.headingWeight;
    if (a.borderRadius) s['--site-radius'] = a.borderRadius;
    if (a.gutterWidth) s['--site-gutter'] = a.gutterWidth;
    if (a.pagePadding) s['--site-page-padding'] = a.pagePadding;
    if (a.postPadding) s['--site-post-padding'] = a.postPadding;
    if (a.maxContentWidth) s['--site-max-width'] = a.maxContentWidth;
    if (a.blockPadding) s['--site-block-padding'] = a.blockPadding;

    // Background / text / line-height: flow through both as raw inline
    // styles AND as variables on the public site. The admin shell has
    // its own controlled chrome (sidebar, header, neutral page bg) and
    // would look broken if these were applied to its root, so we skip
    // the inline-style versions in admin mode but still expose the
    // variables so individual admin components can opt in.
    if (a.backgroundColor) {
        const css = colorCssValue(a.backgroundColor, '',);
        if (css) {
            s['--site-bg'] = css;
            if (mode === 'public') s['background-color'] = css;
        }
    }
    if (a.textColor) {
        const css = colorCssValue(a.textColor, '',);
        if (css) {
            s['--site-text'] = css;
            if (mode === 'public') s['color'] = css;
        }
    }
    const ff = fontStack(a.fontFamily,);
    if (ff) {
        s['--site-font'] = ff;
        if (mode === 'public') s['font-family'] = ff;
    }
    if (a.lineHeight) {
        s['--site-line-height'] = a.lineHeight;
        if (mode === 'public') s['line-height'] = a.lineHeight;
    }

    return s;
}

/**
 * Compute the wrapper padding for a page/post content container from its
 * two independent opt-in flags.
 *
 * - The padding value (`--site-page-padding` / `--site-post-padding`) drives
 *   the block axis (top/bottom) via `padding-block`. A single value or a
 *   two-value shorthand ("80px 20px" → top/bottom) both work.
 * - The site gutter (`--site-gutter`, falling back to 16px) drives the
 *   inline axis (left/right) via `padding-inline`.
 *
 * `padding-block` and `padding-inline` are used (not the `padding`
 * shorthand + longhand overrides) because a `var()` inside the `padding`
 * shorthand cannot coexist with `padding-left/right` overrides — the
 * browser drops the top/bottom. The two logical properties don't overlap,
 * so each keeps its `var()` intact.
 *
 * Both flags default to `true` (pass `undefined` → treated as on).
 */
export function contentPaddingStyle(
    paddingVar: '--site-page-padding' | '--site-post-padding',
    applyPadding: boolean | undefined,
    applyGutter: boolean | undefined,
): Record<string, string> {
    return {
        'padding-block': (applyPadding ?? true) ? `var(${paddingVar}, 0px)` : '0px',
        'padding-inline': (applyGutter ?? true) ? 'var(--site-gutter, 16px)' : '0px',
    };
}

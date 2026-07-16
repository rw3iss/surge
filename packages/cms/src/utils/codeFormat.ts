/**
 * Minimal, dependency-free code formatters for the admin editors.
 *
 * `formatCss` pretty-prints CSS (and SCSS/Sass — nested rules just fall out
 * of the brace handling). `formatHtml` pretty-prints HTML into a clean,
 * hierarchical, one-node-per-line layout and formats any embedded
 * `<style>` block through `formatCss` — so a Custom HTML block that mixes
 * markup and CSS gets both tidied in one pass.
 *
 * These are intentionally small (no parser dependency): a character scanner
 * that is correct for the common cases authors hit in a CMS block. Known
 * trade-offs:
 *   - Every tag / text run goes on its own line (inline elements included),
 *     which is readable but can introduce insignificant whitespace between
 *     inline elements. `<pre>`, `<textarea>` and `<script>` are preserved
 *     verbatim so their significant whitespace / code is never touched.
 *   - It reformats, it does not validate: malformed markup is reflowed as
 *     best it can, never thrown on.
 */

const INDENT = '  ';

/** HTML elements with no closing tag — they never open an indent level. */
const VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Elements whose text content is CDATA-like and must not be reflowed as
 *  markup. `style` is special-cased to run through the CSS formatter. */
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'pre', 'textarea',]);
/** Of the raw elements, these are preserved byte-for-byte (significant
 *  whitespace / executable code). `style` is excluded — it gets formatted. */
const PRESERVE_ELEMENTS = new Set(['script', 'pre', 'textarea',]);

// ─── CSS / SCSS ───────────────────────────────────────────────────

/** Turn a `prop:value` declaration into `prop: value` (only the first colon
 *  splits — values may contain their own colons, e.g. `url(http://…)`). */
function formatDeclaration(decl: string,): string {
    const trimmed = decl.trim().replace(/\s+/g, ' ',);
    const colon = trimmed.indexOf(':',);
    if (colon === -1) return trimmed;
    const prop = trimmed.slice(0, colon,).trim();
    const value = trimmed.slice(colon + 1,).trim();
    return `${prop}: ${value}`;
}

/**
 * Pretty-print CSS or SCSS. `baseIndent` lets a caller (e.g. the HTML
 * formatter) nest the output under an existing indent level.
 */
export function formatCss(input: string, baseIndent = 0,): string {
    const src = input.trim();
    if (!src) return '';
    const out: string[] = [];
    let indent = baseIndent;
    let buffer = '';
    let i = 0;

    const pad = () => INDENT.repeat(Math.max(baseIndent, indent,),);
    const pushBuffered = (render: (text: string,) => string,) => {
        const text = buffer.trim().replace(/\s+/g, ' ',);
        buffer = '';
        if (text) out.push(pad() + render(text,),);
    };

    while (i < src.length) {
        const ch = src[i];

        // Block comment — emit whole, on its own line.
        if (ch === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2,);
            const stop = end === -1 ? src.length : end + 2;
            const pending = buffer.trim().replace(/\s+/g, ' ',);
            buffer = '';
            if (pending) out.push(pad() + pending,);
            out.push(pad() + src.slice(i, stop,),);
            i = stop;
            continue;
        }

        // Quoted string — copy verbatim into the buffer.
        if (ch === '"' || ch === '\'') {
            let j = i + 1;
            while (j < src.length && src[j] !== ch) {
                if (src[j] === '\\') j++;
                j++;
            }
            buffer += src.slice(i, j + 1,);
            i = j + 1;
            continue;
        }

        if (ch === '{') {
            const sel = buffer.trim().replace(/\s+/g, ' ',);
            buffer = '';
            out.push(pad() + (sel ? `${sel} {` : '{'),);
            indent++;
            i++;
            continue;
        }

        if (ch === '}') {
            pushBuffered(d => `${formatDeclaration(d,)};`,); // trailing decl w/o ;
            indent = Math.max(baseIndent, indent - 1,);
            out.push(pad() + '}',);
            i++;
            continue;
        }

        if (ch === ';') {
            pushBuffered(d => `${formatDeclaration(d,)};`,);
            i++;
            continue;
        }

        buffer += ch;
        i++;
    }

    pushBuffered(d => formatDeclaration(d,),);
    return out.join('\n',);
}

// ─── HTML ─────────────────────────────────────────────────────────

/** Find the index of the `>` that closes the tag starting at `start`,
 *  skipping over quoted attribute values. Returns src.length-1 if none. */
function findTagEnd(src: string, start: number,): number {
    let i = start + 1;
    while (i < src.length) {
        const ch = src[i];
        if (ch === '"' || ch === '\'') {
            i++;
            while (i < src.length && src[i] !== ch) i++;
        } else if (ch === '>') {
            return i;
        }
        i++;
    }
    return src.length - 1;
}

/** Extract the lowercased tag name from a tag string like `<div class=…>`. */
function tagNameOf(tag: string,): string {
    const m = /^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag,);
    return m ? m[1].toLowerCase() : '';
}

/**
 * Pretty-print HTML into a hierarchical, one-node-per-line layout. Embedded
 * `<style>` blocks are formatted with {@link formatCss}; `<script>`,
 * `<pre>` and `<textarea>` are preserved verbatim.
 */
export function formatHtml(input: string,): string {
    const src = input.trim();
    if (!src) return '';
    const out: string[] = [];
    let indent = 0;
    let i = 0;
    const pad = () => INDENT.repeat(Math.max(0, indent,),);

    while (i < src.length) {
        const ch = src[i];

        if (ch === '<') {
            // Comment.
            if (src.startsWith('<!--', i,)) {
                const end = src.indexOf('-->', i + 4,);
                const stop = end === -1 ? src.length : end + 3;
                out.push(pad() + src.slice(i, stop,).trim(),);
                i = stop;
                continue;
            }
            // Doctype / CDATA / processing instruction.
            if (src[i + 1] === '!' || src[i + 1] === '?') {
                const end = src.indexOf('>', i,);
                const stop = end === -1 ? src.length : end + 1;
                out.push(pad() + src.slice(i, stop,).trim(),);
                i = stop;
                continue;
            }

            const tagEnd = findTagEnd(src, i,);
            const tag = src.slice(i, tagEnd + 1,);
            const isClosing = src[i + 1] === '/';
            const name = tagNameOf(tag,);
            const selfClosing = /\/\s*>$/.test(tag,);

            if (isClosing) {
                indent = Math.max(0, indent - 1,);
                out.push(pad() + tag.trim(),);
                i = tagEnd + 1;
                continue;
            }

            // Raw-text element: capture its content up to the matching close.
            if (RAW_TEXT_ELEMENTS.has(name,) && !selfClosing) {
                const closeRe = new RegExp(`</\\s*${name}\\s*>`, 'i',);
                closeRe.lastIndex = tagEnd + 1;
                const rest = src.slice(tagEnd + 1,);
                const m = closeRe.exec(rest,);
                const contentEnd = m ? tagEnd + 1 + m.index : src.length;
                const closeTag = m ? m[0] : `</${name}>`;
                const content = src.slice(tagEnd + 1, contentEnd,);

                out.push(pad() + tag.trim(),);
                indent++;
                if (name === 'style') {
                    const css = formatCss(content, indent,);
                    if (css) out.push(css,);
                } else if (content.trim()) {
                    // Preserve script / pre / textarea content verbatim.
                    for (const line of content.replace(/^\n+|\n+$/g, '',).split('\n',)) {
                        out.push(line,);
                    }
                }
                indent = Math.max(0, indent - 1,);
                out.push(pad() + closeTag.trim(),);
                i = m ? contentEnd + closeTag.length : src.length;
                continue;
            }

            // Regular open tag (or void / self-closing — no indent change).
            out.push(pad() + tag.trim(),);
            if (!VOID_ELEMENTS.has(name,) && !selfClosing) indent++;
            i = tagEnd + 1;
            continue;
        }

        // Text run up to the next tag.
        const next = src.indexOf('<', i,);
        const stop = next === -1 ? src.length : next;
        const text = src.slice(i, stop,).replace(/\s+/g, ' ',).trim();
        if (text) out.push(pad() + text,);
        i = stop;
    }

    return out.join('\n',);
}

/**
 * Format a mixed HTML+CSS snippet. Custom HTML blocks routinely embed a
 * `<style>` element, so this is just {@link formatHtml} (which formats
 * embedded CSS) — exposed under a clear name for call sites.
 */
export function formatHtmlDocument(input: string,): string {
    return formatHtml(input,);
}

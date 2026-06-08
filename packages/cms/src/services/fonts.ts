/**
 * Fonts service — typed client for the /fonts API.
 *
 * Mirrors the backend SDK's `cms.fonts` shape so admin code can call
 * `fonts.list()` / `fonts.upload(file, opts)` / `fonts.remove(id)`
 * without thinking about HTTP. A central `loadFonts()` plus a Solid
 * signal lets components subscribe to the live font list without
 * each one re-fetching.
 */
import { createSignal, } from 'solid-js';
import { cms, } from './cmsClient';

export interface Font {
    id: string;
    customId: string;
    originalName: string;
    fileName: string;
    format: string;
    sizeBytes: number;
    familyName?: string | null;
    url: string;
    createdAt: string;
    updatedAt: string;
}

const [fonts, setFonts,] = createSignal<Font[]>([],);
let loadPromise: Promise<Font[]> | null = null;
let loaded = false;

export { fonts, };

/** Lazy-load the font list. Subsequent callers share the in-flight
 *  promise; once loaded, returns the cached signal value. */
export function loadFonts(forceRefresh = false,): Promise<Font[]> {
    if (loaded && !forceRefresh) return Promise.resolve(fonts(),);
    if (loadPromise && !forceRefresh) return loadPromise;
    loadPromise = (async () => {
        try {
            const list = await cms.fonts.list();
            const data = Array.isArray(list,) ? (list as unknown as Font[]) : [];
            setFonts(data,);
            loaded = true;
            return data;
        } catch {
            setFonts([],);
            loaded = true;
            return [];
        }
    })();
    return loadPromise;
}

/** Force-refresh after a write. */
export async function reloadFonts(): Promise<Font[]> {
    loadPromise = null;
    loaded = false;
    return loadFonts();
}

export interface UploadFontOptions {
    customId?: string;
    familyName?: string;
}

/** Upload a font file via FormData. Returns the new Font row on
 *  success, throws with a server-supplied message on failure. */
export async function uploadFont(file: File, opts: UploadFontOptions = {},): Promise<Font> {
    const fields: Record<string, string> = {};
    if (opts.customId) fields.customId = opts.customId;
    if (opts.familyName) fields.familyName = opts.familyName;

    // The client builds the multipart FormData internally and applies the
    // same cookie + CSRF transport the old hand-rolled fetch used.
    const created = await cms.fonts.upload(file, fields,);
    await reloadFonts();
    return created as unknown as Font;
}

export async function deleteFont(id: string,): Promise<void> {
    await cms.fonts.remove(id,);
    await reloadFonts();
}

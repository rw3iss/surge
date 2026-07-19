/**
 * Stable variable keys for form questions.
 *
 * Form answers are keyed by question UUID, but the `{{ … }}` template used by
 * the `email` form action needs human-readable, valid identifier keys (e.g.
 * `{{email}}`). We derive those deterministically from the question text so the
 * backend (building the email render context) and the admin editor (the
 * variables help list) always agree on the same tokens.
 */

/** Slugify a question's text into a valid `{{key}}` identifier: lowercase,
 *  non-alphanumeric runs → `_`, trimmed. Falls back to `field` when empty. */
export function slugifyFieldKey(text: string,): string {
    const key = (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_',)
        .replace(/^_+|_+$/g, '',);
    return key || 'field';
}

/** Map each question id → a UNIQUE derived key. Collisions get numeric suffixes
 *  (`name`, `name_2`, `name_3`) so every field is addressable. Order-stable. */
export function deriveFieldKeys(questions: ReadonlyArray<{ id: string; question: string; }>,): Record<string, string> {
    const seen = new Map<string, number>();
    const out: Record<string, string> = {};
    for (const q of questions) {
        const base = slugifyFieldKey(q.question,);
        const n = seen.get(base,) ?? 0;
        seen.set(base, n + 1,);
        out[q.id] = n === 0 ? base : `${base}_${n + 1}`;
    }
    return out;
}

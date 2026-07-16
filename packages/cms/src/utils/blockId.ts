/**
 * Canonical block-id generator, shared by every editor.
 *
 * Block IDs are real UUIDs from the moment a block is created so a group
 * child can reference its parent before either has been saved (the backend's
 * `createBlock` accepts a client-supplied id). Previously each editor defined
 * its own generator — and the post editor's diverged to a non-UUID
 * `block-<n>` scheme, which forced a downstream `startsWith('block-')` hack.
 * One definition keeps them consistent.
 */
export function generateBlockId(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        // Fallback for older browsers — still a valid v4-shaped id via random hex.
        : `${Date.now().toString(16,)}-${Math.random().toString(16,).slice(2,)}`;
}

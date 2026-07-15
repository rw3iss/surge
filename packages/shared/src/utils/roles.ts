/** Role predicates shared by the API route manifests and the CMS UI.
 *  Centralized so a future role addition (e.g. an editor tier) is a
 *  one-file change rather than a hunt for inline `role === 'admin'`
 *  literals. */
export function isAdminRole(role?: string,): boolean {
    return role === 'admin' || role === 'sysadmin';
}

/** Content-editing staff: admins/sysadmins plus the `editor` role. These
 *  users can sign into the admin, edit content, and be attributed as a
 *  post author — but not manage plugins / settings / users. */
export function isStaffRole(role?: string,): boolean {
    return isAdminRole(role,) || role === 'editor';
}

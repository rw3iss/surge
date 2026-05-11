/**
 * Mailing list create/edit page. Top section: list settings form
 * (name/slug/description/flags). Bottom section: paginated subscriber
 * table with search + bulk-delete + manual-add modal.
 *
 * Templates dropdown for `default_template_id` is stubbed for Phase 3.
 */
import { Title, } from '@solidjs/meta';
import { A, useNavigate, useParams, } from '@solidjs/router';
import {
    Component, createResource, createSignal, For, onMount, Show,
} from 'solid-js';
import { Portal, } from 'solid-js/web';
import type { MailingList, MailingListSubscriber, } from '@rw/shared';
import { mailingListsApi, } from '../../services/api';

interface SubscriberListResponse { items: MailingListSubscriber[]; total: number; }

const MailingListEdit: Component = () => {
    const params = useParams<{ id: string; }>();
    const navigate = useNavigate();
    const isNew = () => params.id === 'new';

    const [name, setName,] = createSignal('',);
    const [slug, setSlug,] = createSignal('',);
    const [description, setDescription,] = createSignal('',);
    const [isEnabled, setIsEnabled,] = createSignal(true,);
    const [registeredUsersOnly, setRegisteredUsersOnly,] = createSignal(false,);
    const [doubleOptIn, setDoubleOptIn,] = createSignal(false,);
    const [saving, setSaving,] = createSignal(false,);
    const [error, setError,] = createSignal<string | null>(null,);

    const [search, setSearch,] = createSignal('',);
    const [selectedIds, setSelectedIds,] = createSignal(new Set<string>(),);
    const [showAdd, setShowAdd,] = createSignal(false,);
    const [editingSub, setEditingSub,] = createSignal<MailingListSubscriber | null>(null,);

    onMount(async () => {
        if (isNew()) return;
        const res = await mailingListsApi.get(params.id,);
        if (res.success && res.data) {
            const l = res.data as MailingList;
            setName(l.name,);
            setSlug(l.slug,);
            setDescription(l.description ?? '',);
            setIsEnabled(l.isEnabled,);
            setRegisteredUsersOnly(l.registeredUsersOnly,);
            setDoubleOptIn(l.doubleOptIn,);
        }
    },);

    const slugify = (s: string,): string =>
        s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-',).replace(/^-+|-+$/g, '',).slice(0, 64,);

    const handleSave = async (): Promise<void> => {
        setSaving(true,);
        setError(null,);
        try {
            const data = {
                slug: slug() || slugify(name(),),
                name: name(),
                description: description() || undefined,
                isEnabled: isEnabled(),
                registeredUsersOnly: registeredUsersOnly(),
                doubleOptIn: doubleOptIn(),
            };
            if (isNew()) {
                const res = await mailingListsApi.create(data,);
                if (res.success && res.data) {
                    navigate(`/admin/mailing-lists/${(res.data as MailingList).id}`,);
                } else {
                    setError(typeof res.error === 'string' ? res.error : 'Save failed.',);
                }
            } else {
                const res = await mailingListsApi.update(params.id, data,);
                if (!res.success) setError(typeof res.error === 'string' ? res.error : 'Save failed.',);
            }
        } finally { setSaving(false,); }
    };

    const handleDelete = async (): Promise<void> => {
        if (!confirm('Delete this list and all its subscribers? This cannot be undone.',)) return;
        await mailingListsApi.remove(params.id,);
        navigate('/admin/mailing-lists',);
    };

    // ─── Subscribers ───────────────────────────────────────────────

    const [subscribers, { refetch: refetchSubs, },] = createResource(
        () => isNew() ? null : { id: params.id, search: search(), },
        async (args,) => {
            if (!args) return null;
            const res = await mailingListsApi.listSubscribers(args.id, { search: args.search, limit: 100, },);
            return res.success ? (res as { data: SubscriberListResponse; }).data : { items: [], total: 0, };
        },
    );

    const toggleSelect = (id: string,): void => {
        const next = new Set(selectedIds(),);
        if (next.has(id,)) next.delete(id,); else next.add(id,);
        setSelectedIds(next,);
    };

    const bulkDelete = async (): Promise<void> => {
        const ids = Array.from(selectedIds(),);
        if (ids.length === 0) return;
        if (!confirm(`Remove ${ids.length} subscriber(s) from the list?`,)) return;
        await mailingListsApi.bulkRemoveSubscribers(params.id, ids,);
        setSelectedIds(new Set<string>(),);
        refetchSubs();
    };

    return (
        <div class="mailing-list-edit-page">
            <Title>{isNew() ? 'New List' : name() || 'Edit List'} - Admin</Title>

            <div class="admin-header">
                <A href="/admin/mailing-lists" class="admin-header__back">← Lists</A>
                <h1>{isNew() ? 'New Mailing List' : name() || '…'}</h1>
                <div class="admin-header__actions">
                    <Show when={!isNew()}>
                        <A href={`/admin/mail/send?list=${params.id}`} class="btn btn--secondary">Send to this list</A>
                        <button type="button" class="btn btn--danger" onClick={handleDelete}>Delete</button>
                    </Show>
                    <button type="button" class="btn btn--primary" onClick={handleSave} disabled={saving()}>
                        {saving() ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>

            <Show when={error()}>
                <div class="alert alert--error">{error()}</div>
            </Show>

            <section class="admin-section">
                <header class="admin-section__header"><h2>Settings</h2></header>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Name</label>
                        <input
                            type="text"
                            value={name()}
                            onInput={(e,) => {
                                setName(e.currentTarget.value,);
                                if (isNew() && !slug()) setSlug(slugify(e.currentTarget.value,),);
                            }}
                        />
                    </div>
                    <div class="form-group">
                        <label>Slug</label>
                        <input
                            type="text"
                            value={slug()}
                            onInput={(e,) => setSlug(slugify(e.currentTarget.value,),)}
                            placeholder="newsletter"
                        />
                        <small class="form-help">Public subscribe URL: <code>/lists/{slug() || '<slug>'}/subscribe</code></small>
                    </div>
                    <div class="form-group form-group--full">
                        <label>Description</label>
                        <textarea
                            rows={2}
                            value={description()}
                            onInput={(e,) => setDescription(e.currentTarget.value,)}
                        />
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input
                                type="checkbox"
                                checked={isEnabled()}
                                onChange={(e,) => setIsEnabled(e.currentTarget.checked,)}
                            />
                            <span>Enabled</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input
                                type="checkbox"
                                checked={registeredUsersOnly()}
                                onChange={(e,) => setRegisteredUsersOnly(e.currentTarget.checked,)}
                            />
                            <span>Registered users only</span>
                        </label>
                        <small class="form-help">Public subscribe requires a logged-in user.</small>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input
                                type="checkbox"
                                checked={doubleOptIn()}
                                onChange={(e,) => setDoubleOptIn(e.currentTarget.checked,)}
                            />
                            <span>Double opt-in</span>
                        </label>
                        <small class="form-help">Subscribers must click a confirmation link before receiving mail.</small>
                    </div>
                </div>
            </section>

            <Show when={!isNew()}>
                <section class="admin-section">
                    <header class="admin-section__header">
                        <h2>Subscribers ({subscribers()?.total ?? 0})</h2>
                        <div class="admin-section__actions">
                            <input
                                type="search"
                                placeholder="Search name or email…"
                                value={search()}
                                onInput={(e,) => setSearch(e.currentTarget.value,)}
                            />
                            <Show when={selectedIds().size > 0}>
                                <button type="button" class="btn btn--small btn--danger" onClick={bulkDelete}>
                                    Remove {selectedIds().size}
                                </button>
                            </Show>
                            <button type="button" class="btn btn--small btn--primary" onClick={() => setShowAdd(true,)}>
                                + Add Subscriber
                            </button>
                        </div>
                    </header>

                    <Show when={!subscribers.loading} fallback={<p>Loading…</p>}>
                        <Show
                            when={(subscribers()?.items ?? []).length > 0}
                            fallback={<div class="empty-state"><em>No subscribers match.</em></div>}
                        >
                            <div class="admin-table-container">
                                <table class="admin-table">
                                    <thead>
                                        <tr>
                                            <th />
                                            <th>Email</th>
                                            <th>Name</th>
                                            <th>Phone</th>
                                            <th>Status</th>
                                            <th>Subscribed</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={subscribers()?.items ?? []}>
                                            {(s,) => (
                                                <tr>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds().has(s.id,)}
                                                            onChange={() => toggleSelect(s.id,)}
                                                        />
                                                    </td>
                                                    <td>{s.email}</td>
                                                    <td>{s.name ?? ''}</td>
                                                    <td>{s.phone ?? ''}</td>
                                                    <td><span class={`badge badge--${s.status === 'subscribed' ? 'success' : 'muted'}`}>{s.status}</span></td>
                                                    <td>{new Date(s.subscribedAt,).toLocaleDateString()}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            class="btn btn--small btn--secondary"
                                                            onClick={() => setEditingSub(s,)}
                                                        >Edit</button>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </Show>
                    </Show>

                    <Show when={showAdd()}>
                        <SubscriberFormModal
                            listId={params.id}
                            onClose={() => setShowAdd(false,)}
                            onSaved={() => { setShowAdd(false,); refetchSubs(); }}
                        />
                    </Show>
                    <Show when={editingSub()}>
                        <SubscriberFormModal
                            listId={params.id}
                            subscriber={editingSub()!}
                            onClose={() => setEditingSub(null,)}
                            onSaved={() => { setEditingSub(null,); refetchSubs(); }}
                        />
                    </Show>
                </section>
            </Show>
        </div>
    );
};

// ─── Subscriber add/edit modal ──────────────────────────────────────

interface SubscriberFormModalProps {
    listId: string;
    subscriber?: MailingListSubscriber;
    onClose: () => void;
    onSaved: () => void;
}

const SubscriberFormModal: Component<SubscriberFormModalProps> = (p,) => {
    const isEditing = () => !!p.subscriber;
    const [email, setEmail,] = createSignal(p.subscriber?.email ?? '',);
    const [name, setName,] = createSignal(p.subscriber?.name ?? '',);
    const [phone, setPhone,] = createSignal(p.subscriber?.phone ?? '',);
    const [saving, setSaving,] = createSignal(false,);
    const [error, setError,] = createSignal<string | null>(null,);

    const handleSave = async (): Promise<void> => {
        setSaving(true,);
        setError(null,);
        try {
            const data = { email: email(), name: name() || undefined, phone: phone() || undefined, };
            if (isEditing()) {
                await mailingListsApi.updateSubscriber(p.listId, p.subscriber!.id, data,);
            } else {
                await mailingListsApi.addSubscriber(p.listId, data,);
            }
            p.onSaved();
        } catch (e) {
            setError(String(e,),);
        } finally { setSaving(false,); }
    };

    const handleRemove = async (): Promise<void> => {
        if (!confirm('Remove this subscriber?',)) return;
        await mailingListsApi.removeSubscriber(p.listId, p.subscriber!.id,);
        p.onSaved();
    };

    const handleForceConfirm = async (): Promise<void> => {
        await mailingListsApi.forceConfirm(p.listId, p.subscriber!.id,);
        p.onSaved();
    };

    return (
        <Portal>
            <div class="confirm-modal-overlay" onClick={p.onClose}>
                <div class="subscriber-modal" onClick={(e,) => e.stopPropagation()}>
                <h3>{isEditing() ? 'Edit Subscriber' : 'Add Subscriber'}</h3>
                <Show when={error()}>
                    <div class="alert alert--error">{error()}</div>
                </Show>
                <div class="form-group">
                    <label>Email</label>
                    <input
                        type="email"
                        value={email()}
                        onInput={(e,) => setEmail(e.currentTarget.value,)}
                        disabled={isEditing()}
                    />
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input
                        type="text"
                        value={name()}
                        onInput={(e,) => setName(e.currentTarget.value,)}
                    />
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input
                        type="tel"
                        value={phone()}
                        onInput={(e,) => setPhone(e.currentTarget.value,)}
                    />
                </div>
                <Show when={isEditing() && p.subscriber?.status === 'pending_confirmation'}>
                    <button type="button" class="btn btn--small btn--secondary" onClick={handleForceConfirm}>
                        Force Confirm
                    </button>
                </Show>
                <div class="modal-actions">
                    <Show when={isEditing()}>
                        <button type="button" class="btn btn--danger" onClick={handleRemove}>Remove</button>
                    </Show>
                    <button type="button" class="btn btn--secondary" onClick={p.onClose}>Cancel</button>
                    <button type="button" class="btn btn--primary" onClick={handleSave} disabled={saving()}>
                        {saving() ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
        </Portal>
    );
};

export default MailingListEdit;

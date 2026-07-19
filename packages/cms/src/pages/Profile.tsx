import { useNavigate, } from '@solidjs/router';
import { Component, createEffect, createMemo, Show, } from 'solid-js';
import { createSignal, } from 'solid-js';
import SeoHead from '../components/common/seo/SeoHead';
import { cms, } from '../services/cmsClient';
import { useAuth, } from '../stores/auth';
import { isFeatureEnabled, siteName, siteSettings, } from '../stores/siteSettings';
import './Profile.scss';

const BIO_MAX = 250;

/**
 * Self-service user profile (`/profile`). Requires login (else → /login?redirect=profile)
 * and the `users` feature (else → home). Users edit avatar, name, a short bio,
 * and city/state. Membership tiers are a coming-soon placeholder for now.
 */
const Profile: Component = () => {
    const auth = useAuth();
    const navigate = useNavigate();

    const [firstName, setFirstName,] = createSignal('',);
    const [lastName, setLastName,] = createSignal('',);
    const [bio, setBio,] = createSignal('',);
    const [city, setCity,] = createSignal('',);
    const [stateRegion, setStateRegion,] = createSignal('',);
    const [avatarUrl, setAvatarUrl,] = createSignal<string | undefined>(undefined,);
    const [status, setStatus,] = createSignal<'idle' | 'saving' | 'success' | 'error'>('idle',);
    const [error, setError,] = createSignal('',);
    const [initialized, setInitialized,] = createSignal(false,);
    let avatarInput: HTMLInputElement | undefined;

    // ── Guards: redirect once auth + settings have settled ──
    const settingsReady = () => siteSettings() != null;
    createEffect(() => {
        if (auth.isLoading) return; // wait for the session probe
        if (!auth.isAuthenticated) {
            navigate('/login?redirect=profile', { replace: true, },);
            return;
        }
        // `users` defaults false until /settings/public loads, so only act
        // once settings are actually present.
        if (settingsReady() && !isFeatureEnabled('users',)) {
            navigate('/', { replace: true, },);
        }
    },);

    // Seed the form from the current user the first time it's available.
    createEffect(() => {
        const u = auth.user;
        if (u && !initialized()) {
            setFirstName(u.firstName ?? '',);
            setLastName(u.lastName ?? '',);
            setBio(u.bio ?? '',);
            setCity(u.locationCity ?? '',);
            setStateRegion(u.locationState ?? '',);
            setAvatarUrl(u.avatarUrl,);
            setInitialized(true,);
        }
    },);

    const initials = createMemo(() => {
        const u = auth.user;
        const base = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.displayName || u?.email || '';
        return base.split(/\s+/,).slice(0, 2,).map((p,) => p[0]?.toUpperCase() ?? '',).join('',) || '?';
    },);

    const save = async (e: Event,) => {
        e.preventDefault();
        setStatus('saving',);
        setError('',);
        try {
            await cms.auth.updateProfile({
                firstName: firstName().trim() || null,
                lastName: lastName().trim() || null,
                bio: bio().trim() || null,
                locationCity: city().trim() || null,
                locationState: stateRegion().trim() || null,
            },);
            await auth.refreshUser();
            setStatus('success',);
            setTimeout(() => setStatus('idle',), 2500,);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save your profile.',);
            setStatus('error',);
        }
    };

    const onAvatarChange = async (e: Event,) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        setError('',);
        try {
            const res = await cms.auth.uploadAvatar(file,);
            setAvatarUrl(res.user.avatarUrl,);
            await auth.refreshUser();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Avatar upload failed.',);
        }
    };

    return (
        <div class="profile page-wrapper">
            <SeoHead title="My Profile" description="Manage your profile and account details." noindex />
            <Show
                when={!auth.isLoading && auth.isAuthenticated}
                fallback={<div class="profile__loading">Loading…</div>}
            >
                <div class="profile__container">
                    <div class="page-header">
                        <h1>My Profile</h1>
                        <p>Manage your profile and account details for {siteName()}.</p>
                    </div>

                    <form class="profile__card" onSubmit={save}>
                        <div class="profile__avatar-row">
                            <button
                                type="button"
                                class="profile__avatar"
                                onClick={() => avatarInput?.click()}
                                title="Change your avatar"
                                aria-label="Change your avatar"
                            >
                                <Show
                                    when={avatarUrl()}
                                    fallback={<span class="profile__avatar-initials">{initials()}</span>}
                                >
                                    <img src={avatarUrl()} alt="Your avatar" class="profile__avatar-img" />
                                </Show>
                                <span class="profile__avatar-edit">Change</span>
                            </button>
                            <input
                                ref={avatarInput}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none', }}
                                onChange={onAvatarChange}
                            />
                            <div class="profile__identity">
                                <span class="profile__display-name">{auth.user?.displayName}</span>
                                <span class="profile__email">{auth.user?.email}</span>
                            </div>
                        </div>

                        <div class="profile__row">
                            <label class="profile__field">
                                <span class="profile__label">First name</span>
                                <input
                                    class="profile__input"
                                    type="text"
                                    maxLength={100}
                                    value={firstName()}
                                    onInput={(ev,) => setFirstName(ev.currentTarget.value,)}
                                    placeholder="First name"
                                />
                            </label>
                            <label class="profile__field">
                                <span class="profile__label">Last name</span>
                                <input
                                    class="profile__input"
                                    type="text"
                                    maxLength={100}
                                    value={lastName()}
                                    onInput={(ev,) => setLastName(ev.currentTarget.value,)}
                                    placeholder="Last name"
                                />
                            </label>
                        </div>

                        <label class="profile__field">
                            <span class="profile__label">About you</span>
                            <textarea
                                class="profile__textarea"
                                rows={4}
                                maxLength={BIO_MAX}
                                value={bio()}
                                onInput={(ev,) => setBio(ev.currentTarget.value,)}
                                placeholder="A short summary about yourself…"
                            />
                            <span class="profile__counter">{bio().length}/{BIO_MAX}</span>
                        </label>

                        <div class="profile__row">
                            <label class="profile__field">
                                <span class="profile__label">City</span>
                                <input
                                    class="profile__input"
                                    type="text"
                                    maxLength={100}
                                    value={city()}
                                    onInput={(ev,) => setCity(ev.currentTarget.value,)}
                                    placeholder="City"
                                />
                            </label>
                            <label class="profile__field">
                                <span class="profile__label">State / Region</span>
                                <input
                                    class="profile__input"
                                    type="text"
                                    maxLength={100}
                                    value={stateRegion()}
                                    onInput={(ev,) => setStateRegion(ev.currentTarget.value,)}
                                    placeholder="State or region"
                                />
                            </label>
                        </div>

                        <div class="profile__membership">
                            <span class="profile__label">Membership</span>
                            <p class="profile__membership-note">
                                You're on the free plan. Paid membership tiers are coming soon.
                            </p>
                        </div>

                        <Show when={error()}>
                            <div class="profile__error">{error()}</div>
                        </Show>

                        <div class="profile__actions">
                            <button
                                type="submit"
                                class="profile__save"
                                disabled={status() === 'saving'}
                            >
                                {status() === 'saving' ? 'Saving…' : 'Save changes'}
                            </button>
                            <Show when={status() === 'success'}>
                                <span class="profile__saved">Saved ✓</span>
                            </Show>
                        </div>
                    </form>
                </div>
            </Show>
        </div>
    );
};

export default Profile;

import { Component, For, Show, createSignal } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { useAuth } from '../../stores/auth';
import type { NavigationItem } from '@surge/shared';
import './Header.scss';

interface HeaderProps {
  navigation: NavigationItem[];
  siteName: string;
  logo?: string;
}

export const Header: Component<HeaderProps> = (props) => {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const location = useLocation();
  const auth = useAuth();

  const isActive = (slug: string) => {
    const path = location.pathname;
    if (slug === 'home' || slug === '/') {
      return path === '/';
    }
    return path === `/${slug}` || path.startsWith(`/${slug}/`);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen());
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header class="header">
      <div class="header__container">
        <A href="/" class="header__logo" onClick={closeMobileMenu}>
          <Show when={props.logo} fallback={<span class="header__logo-text">{props.siteName}</span>}>
            <img src={props.logo} alt={props.siteName} class="header__logo-image" />
          </Show>
        </A>

        <nav class={`header__nav ${mobileMenuOpen() ? 'header__nav--open' : ''}`}>
          <ul class="header__nav-list">
            <For each={props.navigation}>
              {(item) => (
                <Show when={item.isVisible}>
                  <li class="header__nav-item">
                    <Show
                      when={item.isExternal}
                      fallback={
                        <A
                          href={item.slug === 'home' ? '/' : `/${item.slug}`}
                          class={`header__nav-link ${isActive(item.slug) ? 'header__nav-link--active' : ''}`}
                          onClick={closeMobileMenu}
                        >
                          {item.label}
                        </A>
                      }
                    >
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="header__nav-link"
                      >
                        {item.label}
                      </a>
                    </Show>
                  </li>
                </Show>
              )}
            </For>
          </ul>

          <div class="header__actions">
            <Show
              when={auth.isAuthenticated}
              fallback={
                <A href="/login" class="header__btn header__btn--primary" onClick={closeMobileMenu}>
                  Sign In
                </A>
              }
            >
              <div class="header__user">
                <Show when={auth.user?.avatarUrl}>
                  <img
                    src={auth.user?.avatarUrl}
                    alt={auth.user?.displayName}
                    class="header__user-avatar"
                  />
                </Show>
                <span class="header__user-name">{auth.user?.displayName}</span>
                <div class="header__user-dropdown">
                  <Show when={auth.user?.role === 'admin'}>
                    <A href="/admin" class="header__dropdown-item" onClick={closeMobileMenu}>
                      Admin Portal
                    </A>
                  </Show>
                  <button
                    class="header__dropdown-item"
                    onClick={() => {
                      auth.logout();
                      closeMobileMenu();
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </nav>

        <button
          class={`header__mobile-toggle ${mobileMenuOpen() ? 'header__mobile-toggle--open' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen()}
        >
          <span class="header__mobile-toggle-bar" />
          <span class="header__mobile-toggle-bar" />
          <span class="header__mobile-toggle-bar" />
        </button>
      </div>
    </header>
  );
};

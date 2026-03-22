import { Component, createSignal, createEffect, onCleanup, Show, For, on } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { HeroItem, HeroCarouselOptions } from '@surge/shared';
import './HeroCarousel.scss';

export interface HeroCarouselProps {
  items: HeroItem[];
  options: HeroCarouselOptions;
  height?: string;
  previewMode?: boolean;
}

const DEFAULT_HEIGHT = '50vh';

/** Render the appropriate heading tag for h1-h6 */
function HeadingTag(props: { size: string; color: string; children: any; class?: string }) {
  return (
    <Dynamic component={props.size || 'h1'} class={props.class} style={{ color: props.color, margin: 0 }}>
      {props.children}
    </Dynamic>
  );
}

const HeroCarousel: Component<HeroCarouselProps> = (props) => {
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [isTransitioning, setIsTransitioning] = createSignal(false);
  const [isPaused, setIsPaused] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  let trackRef: HTMLDivElement | undefined;
  let autoScrollTimer: ReturnType<typeof setInterval> | undefined;

  // Touch/swipe state
  let touchStartX = 0;
  let touchDeltaX = 0;

  const itemCount = () => props.items.length;
  const hasMultiple = () => itemCount() > 1;

  const resolvedHeight = () => {
    if (props.height) return props.height;
    if (props.options.customHeight && props.options.height) return props.options.height;
    return DEFAULT_HEIGHT;
  };

  // ─── Navigation ───

  const goTo = (index: number) => {
    if (isTransitioning()) return;
    const count = itemCount();
    if (count === 0) return;

    let target = index;
    if (props.options.repeat) {
      target = ((index % count) + count) % count;
    } else {
      target = Math.max(0, Math.min(count - 1, index));
    }

    setIsTransitioning(true);
    setCurrentIndex(target);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const goNext = () => goTo(currentIndex() + 1);
  const goPrev = () => goTo(currentIndex() - 1);

  // ─── Auto-scroll ───

  const startAutoScroll = () => {
    stopAutoScroll();
    if (!props.options.autoScroll || !hasMultiple()) return;
    const interval = props.options.autoScrollInterval || 3000;
    autoScrollTimer = setInterval(() => {
      if (!isPaused()) goNext();
    }, interval);
  };

  const stopAutoScroll = () => {
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = undefined;
    }
  };

  createEffect(on(
    () => [props.options.autoScroll, props.options.autoScrollInterval, props.options.repeat, props.items.length],
    () => {
      startAutoScroll();
    }
  ));

  onCleanup(() => stopAutoScroll());

  // ─── Touch support ───

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    touchDeltaX = 0;
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchDeltaX = e.touches[0].clientX - touchStartX;
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchDeltaX) > 50) {
      if (touchDeltaX < 0) goNext();
      else goPrev();
    }
    touchDeltaX = 0;
  };

  // ─── Video management ───

  const handleVideoRef = (el: HTMLVideoElement, item: HeroItem, index: number) => {
    createEffect(() => {
      const isActive = currentIndex() === index;
      if (isActive && item.autoplay) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    });
  };

  // ─── Render ───

  return (
    <div
      ref={containerRef}
      class={`hero-carousel ${props.previewMode ? 'hero-carousel--preview' : ''}`}
      style={{ height: resolvedHeight() }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Show when={itemCount() === 0}>
        <div class="hero-carousel__empty">No hero content configured</div>
      </Show>

      <Show when={itemCount() > 0}>
        <div
          ref={trackRef}
          class="hero-carousel__track"
          style={{
            transform: `translateX(-${currentIndex() * 100}%)`,
            transition: isTransitioning() ? 'transform 0.5s ease-in-out' : 'none',
          }}
        >
          <For each={props.items}>
            {(item, index) => (
              <div class="hero-carousel__slide">
                {/* Background media */}
                <div class="hero-carousel__media">
                  <Show when={item.mediaType === 'image'}>
                    <img
                      src={item.mediaUrl}
                      alt=""
                      class="hero-carousel__media-element"
                      style={{ 'object-fit': item.objectFit || 'cover' }}
                      loading="lazy"
                    />
                  </Show>
                  <Show when={item.mediaType === 'video'}>
                    <video
                      ref={(el) => handleVideoRef(el, item, index())}
                      src={item.mediaUrl}
                      class="hero-carousel__media-element"
                      style={{ 'object-fit': item.objectFit || 'cover' }}
                      muted
                      loop
                      playsinline
                    />
                  </Show>
                </div>

                {/* Text overlay */}
                <div class="hero-carousel__overlay">
                  <div class="hero-carousel__content">
                    <Show when={item.header?.text}>
                      <HeadingTag
                        size={item.header!.size || 'h1'}
                        color={item.header!.color || '#ffffff'}
                        class="hero-carousel__header"
                      >
                        {item.header!.text}
                      </HeadingTag>
                    </Show>
                    <Show when={item.subheader?.text}>
                      <HeadingTag
                        size={item.subheader!.size || 'h3'}
                        color={item.subheader!.color || '#ffffff'}
                        class="hero-carousel__subheader"
                      >
                        {item.subheader!.text}
                      </HeadingTag>
                    </Show>
                    <Show when={item.action?.label}>
                      <a
                        href={item.action!.url}
                        target={item.action!.openInNewTab ? '_blank' : '_self'}
                        rel={item.action!.openInNewTab ? 'noopener noreferrer' : undefined}
                        class="hero-carousel__action-btn"
                      >
                        {item.action!.label}
                      </a>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Navigation arrows */}
        <Show when={hasMultiple()}>
          <button class="hero-carousel__arrow hero-carousel__arrow--prev" onClick={goPrev} aria-label="Previous">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button class="hero-carousel__arrow hero-carousel__arrow--next" onClick={goNext} aria-label="Next">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18" /></svg>
          </button>

          {/* Dots */}
          <div class="hero-carousel__dots">
            <For each={props.items}>
              {(_, i) => (
                <button
                  class={`hero-carousel__dot ${currentIndex() === i() ? 'hero-carousel__dot--active' : ''}`}
                  onClick={() => goTo(i())}
                  aria-label={`Go to slide ${i() + 1}`}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default HeroCarousel;

/**
 * disclosure.ts
 *
 * @version 1.0.5
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/disclosure-ts}
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface DisclosureOptions {
  readonly animation?: {
    readonly duration?: number;
    readonly easing?: string;
  };
}

type DeepRequired<T> = T extends (...args: unknown[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]-?: DeepRequired<NonNullable<T[K]>> }
      : NonNullable<T>;

type Binding = {
  details: HTMLDetailsElement;
  summary: HTMLElement;
  content: HTMLElement;
  timer: number | undefined;
  animation: Animation | null;
};

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

export default class Disclosure {
  #rootElement: HTMLElement;
  #defaults = {
    animation: {
      duration: 300,
      easing: 'ease',
    },
  };
  #settings: DeepRequired<DisclosureOptions>;
  #detailsElements: HTMLDetailsElement[] | null;
  #summaryElements!: HTMLElement[] | null;
  #contentElements!: HTMLElement[] | null;
  #bindings: WeakMap<HTMLElement, Binding> | null = new WeakMap();
  #controller: AbortController | null = new AbortController();
  #observers: MutationObserver[] | null = [];
  #isDestroyed = false;

  constructor(root: HTMLElement, options: DisclosureOptions = {}) {
    if (!(root instanceof HTMLElement)) {
      throw new TypeError('Invalid root element');
    }

    this.#rootElement = root;
    this.#settings = {
      animation: { ...this.#defaults.animation, ...(options.animation ?? {}) },
    };

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Object.assign(this.#settings.animation, { duration: 0 });
    }

    const NOT_NESTED = ':not(:scope summary + * *)';
    this.#detailsElements = [
      ...this.#rootElement.querySelectorAll<HTMLDetailsElement>(
        `details${NOT_NESTED}`,
      ),
    ];

    if (!this.#detailsElements.length) {
      console.warn('Missing <details> elements');
      return;
    }

    this.#summaryElements = [
      ...this.#rootElement.querySelectorAll<HTMLElement>(
        `summary${NOT_NESTED}`,
      ),
    ];

    if (!this.#summaryElements.length) {
      console.warn('Missing <summary> elements');
      return;
    }

    this.#contentElements = [
      ...this.#rootElement.querySelectorAll<HTMLElement>(
        `summary${NOT_NESTED} + *`,
      ),
    ];

    if (!this.#contentElements.length) {
      console.warn('Missing content elements');
      return;
    }

    this.#initialize();
  }

  open(details: HTMLDetailsElement) {
    if (this.#isDestroyed) {
      return;
    }

    if (
      !(details instanceof HTMLDetailsElement) ||
      !this.#bindings?.has(details)
    ) {
      console.warn('Invalid <details> element');
      return;
    }

    this.#toggle(details, true);
  }

  close(details: HTMLDetailsElement) {
    if (this.#isDestroyed) {
      return;
    }

    if (
      !(details instanceof HTMLDetailsElement) ||
      !this.#bindings?.has(details)
    ) {
      console.warn('Invalid <details> element');
      return;
    }

    this.#toggle(details, false);
  }

  async destroy(force = false) {
    if (this.#isDestroyed) {
      return;
    }

    this.#isDestroyed = true;
    this.#controller?.abort();
    this.#controller = null;

    if (this.#observers) {
      this.#observers.forEach((observer) => {
        observer.disconnect();
      });

      this.#observers = null;
    }

    if (!this.#detailsElements) {
      throw new Error('Unreachable');
    }

    this.#detailsElements.forEach((details) => {
      const binding = this.#bindings?.get(details) as Binding;
      const { timer } = binding;

      if (timer !== undefined) {
        cancelAnimationFrame(timer);
        binding.timer = undefined;
      }
    });

    this.#rootElement.removeAttribute('data-disclosure-initialized');

    this.#detailsElements.forEach((details) => {
      details.removeAttribute('data-disclosure-name');
      details.removeAttribute('data-disclosure-open');
    });

    if (!force) {
      const promises: Promise<void>[] = [];

      this.#detailsElements.forEach((details) => {
        promises.push(
          this.#waitAnimation(
            this.#bindings?.get(details)?.animation as Animation,
          ),
        );
      });

      await Promise.allSettled(promises);
    }

    this.#detailsElements.forEach((details) => {
      this.#bindings?.get(details)?.animation?.cancel();
    });

    this.#detailsElements = null;
    this.#summaryElements = null;
    this.#contentElements = null;
    this.#bindings = null;
  }

  #initialize() {
    const { signal } = this.#controller as AbortController;

    this.#detailsElements?.forEach((details, i) => {
      if (details.name) {
        details.setAttribute('data-disclosure-name', details.name);
      }

      function sync() {
        details.toggleAttribute('data-disclosure-open', details.open);
      }

      const observer = new MutationObserver(sync);
      observer.observe(details, { attributeFilter: ['open'] });
      this.#observers?.push(observer);
      sync();
      const summary = this.#summaryElements?.[i];

      if (!summary) {
        throw new Error('Unreachable');
      }

      if (!this.#isFocusable(summary)) {
        summary.setAttribute('aria-disabled', 'true');
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }

      summary.addEventListener('click', this.#onSummaryClick, { signal });
      summary.addEventListener('keydown', this.#onSummaryKeyDown, { signal });
      const content = this.#contentElements?.[i];

      if (!content) {
        throw new Error('Unreachable');
      }

      const binding = this.#createBinding(details, summary, content);

      if (!this.#bindings) {
        throw new Error('Unreachable');
      }

      this.#bindings.set(details, binding);
      this.#bindings.set(summary, binding);
      this.#bindings.set(content, binding);
    });

    this.#rootElement.setAttribute('data-disclosure-initialized', '');
  }

  #onSummaryClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const { details } = this.#bindings?.get(
      event.currentTarget as HTMLElement,
    ) as Binding;
    this.#toggle(details, !details.hasAttribute('data-disclosure-open'));
  };

  #onSummaryKeyDown = (event: KeyboardEvent) => {
    const { key } = event;

    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const focusables = (this.#summaryElements as HTMLElement[]).filter(
      this.#isFocusable,
    );
    const active = this.#getActiveElement() as HTMLElement;
    const currentIndex = focusables.indexOf(active);
    let newIndex = currentIndex;

    switch (key) {
      case 'End':
        newIndex = -1;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'ArrowUp':
        newIndex = currentIndex - 1;
        break;
      case 'ArrowDown':
        newIndex = (currentIndex + 1) % focusables.length;
        break;
    }

    focusables.at(newIndex)?.focus();
  };

  #toggle(details: HTMLDetailsElement, isOpen: boolean) {
    if (details.hasAttribute('data-disclosure-open') === isOpen) {
      return;
    }

    const name = details.getAttribute('data-disclosure-name');

    if (name && isOpen) {
      const opened = this.#detailsElements?.find(
        (d) =>
          d.hasAttribute('data-disclosure-open') &&
          d.getAttribute('data-disclosure-name') === name,
      );

      if (opened) {
        this.close(opened);
      }
    }

    const binding = this.#bindings?.get(details) as Binding;
    const { content, timer } = binding;
    const startSize = details.open ? content.offsetHeight : 0;
    binding.animation?.cancel();

    if (isOpen) {
      details.open = true;
    }

    const endSize = isOpen ? content.scrollHeight : 0;

    if (timer) {
      cancelAnimationFrame(timer);
    }

    binding.timer = requestAnimationFrame(() => {
      binding.timer = undefined;
      details.toggleAttribute('data-disclosure-open', isOpen);
    });
    content.style.setProperty('overflow', 'clip');
    const { duration, easing } = this.#settings.animation;
    const animation = content.animate(
      { blockSize: [`${startSize}px`, `${endSize}px`] },
      { duration, easing },
    );
    binding.animation = animation;

    function cleanup() {
      if (binding?.animation === animation) {
        binding.animation = null;
      }
    }

    const { signal } = this.#controller as AbortController;
    animation.addEventListener('cancel', cleanup, { once: true, signal });

    animation.addEventListener(
      'finish',
      () => {
        cleanup();

        if (name) {
          details.setAttribute(
            'name',
            details.getAttribute('data-disclosure-name') ?? '',
          );
        }

        if (!isOpen) {
          details.open = false;
        }

        const { style } = content;
        style.removeProperty('block-size');
        style.removeProperty('overflow');
      },
      { once: true, signal },
    );
  }

  #createBinding(
    details: HTMLDetailsElement,
    summary: HTMLElement,
    content: HTMLElement,
  ) {
    return { details, summary, content, timer: undefined, animation: null };
  }

  #getActiveElement() {
    let current = document.activeElement;

    while (current?.shadowRoot?.activeElement) {
      current = current.shadowRoot.activeElement;
    }

    return current;
  }

  #isFocusable(element: HTMLElement) {
    const index = element.getAttribute('tabindex');
    return index || Number(index) >= 0;
  }

  #waitAnimation(animation: Animation) {
    const { playState } = animation;

    if (playState === 'idle' || playState === 'finished') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      function done() {
        resolve();
      }

      animation.addEventListener('cancel', done, { once: true });
      animation.addEventListener('finish', done, { once: true });
    });
  }
}

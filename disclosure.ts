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
  #summaryElements: HTMLElement[] | null;
  #contentElements: HTMLElement[] | null;
  #bindings: WeakMap<HTMLElement, Binding> | null = new WeakMap();
  #controller: AbortController | null = new AbortController();
  #observers: MutationObserver[] | null = [];
  #isDestroyed = false;

  constructor(root: HTMLElement, options: DisclosureOptions = {}) {
    if (!root) {
      throw new Error('Root element missing');
    }

    this.#rootElement = root;
    this.#settings = {
      animation: { ...this.#defaults.animation, ...(options.animation ?? {}) },
    };

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Object.assign(this.#settings.animation, { duration: 0 });
    }

    const NOT_NESTED = ':not(:scope summary + * *)';
    this.#detailsElements = [...this.#rootElement.querySelectorAll<HTMLDetailsElement>(`details${NOT_NESTED}`)];
    this.#summaryElements = [...this.#rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED}`)];
    this.#contentElements = [...this.#rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED} + *`)];

    if (
      this.#detailsElements.length === 0 ||
      this.#summaryElements.length === 0 ||
      this.#contentElements.length === 0
    ) {
      throw new Error('Details, summary or content element missing');
    }

    this.#initialize();
  }

  open(details: HTMLDetailsElement): void {
    if (!this.#isDestroyed && this.#bindings?.has(details)) {
      this.#toggle(details, true);
    }
  }

  close(details: HTMLDetailsElement): void {
    if (!this.#isDestroyed && this.#bindings?.has(details)) {
      this.#toggle(details, false);
    }
  }

  async destroy(isForce = false): Promise<void> {
    if (this.#isDestroyed || !this.#detailsElements || !this.#bindings) {
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

    this.#detailsElements.forEach((details) => {
      const binding = this.#bindings?.get(details);

      if (!binding) {
        return;
      }

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

    if (!isForce) {
      const promises: Promise<void>[] = [];

      this.#detailsElements.forEach((details) => {
        const animation = this.#bindings?.get(details)?.animation;

        if (animation) {
          promises.push(this.#waitAnimation(animation));
        }
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
    if (
      !this.#detailsElements ||
      !this.#summaryElements ||
      !this.#contentElements ||
      !this.#bindings ||
      !this.#controller
    ) {
      return;
    }

    const { signal } = this.#controller;

    this.#detailsElements.forEach((details) => {
      if (details.name) {
        details.setAttribute('data-disclosure-name', details.name);
      }

      const sync = () => {
        details.toggleAttribute('data-disclosure-open', details.open);
      };

      const observer = new MutationObserver(sync);
      observer.observe(details, { attributeFilter: ['open'] });
      this.#observers?.push(observer);
      sync();
    });

    for (let i = 0, l = this.#summaryElements.length; i < l; i++) {
      const details = this.#detailsElements[i];
      const summary = this.#summaryElements[i];

      if (!details || !summary) {
        continue;
      }

      if (!this.#isFocusable(details)) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }

      summary.addEventListener('click', this.#onSummaryClick, { signal });
      summary.addEventListener('keydown', this.#onSummaryKeyDown, { signal });
    }

    for (let i = 0, l = this.#detailsElements.length; i < l; i++) {
      const details = this.#detailsElements[i];
      const summary = this.#summaryElements[i];
      const content = this.#contentElements[i];

      if (!details || !summary || !content) {
        continue;
      }

      const binding = this.#createBinding(details, summary, content);
      this.#bindings.set(details, binding);
      this.#bindings.set(summary, binding);
      this.#bindings.set(content, binding);
    }

    this.#rootElement.setAttribute('data-disclosure-initialized', '');
  }

  #onSummaryClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const summary = event.currentTarget;

    if (!(summary instanceof HTMLElement)) {
      return;
    }

    const binding = this.#bindings?.get(summary);

    if (!binding) {
      return;
    }

    const { details } = binding;
    this.#toggle(details, !details.hasAttribute('data-disclosure-open'));
  };

  #onSummaryKeyDown = (event: KeyboardEvent) => {
    if (!this.#summaryElements) {
      return;
    }

    const { key } = event;

    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const focusables = this.#summaryElements.filter((summary) => {
      const binding = this.#bindings?.get(summary);
      return binding && this.#isFocusable(binding.details);
    });

    const active = this.#getActiveElement();

    if (!active) {
      return;
    }

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
    if (!this.#detailsElements) {
      return;
    }

    const binding = this.#bindings?.get(details);

    if (!binding || isOpen === details.hasAttribute('data-disclosure-open')) {
      return;
    }

    const name = details.getAttribute('data-disclosure-name');

    if (name && isOpen) {
      const opened = this.#detailsElements.find(
        (d) => d.hasAttribute('data-disclosure-open') && d.getAttribute('data-disclosure-name') === name,
      );

      if (opened) {
        this.close(opened);
      }
    }

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
    const animation = content.animate({ blockSize: [`${startSize}px`, `${endSize}px`] }, { duration, easing });
    binding.animation = animation;

    const cleanup = () => {
      if (binding.animation === animation) {
        binding.animation = null;
      }
    };

    if (!this.#controller) {
      return;
    }

    const { signal } = this.#controller;
    animation.addEventListener('cancel', cleanup, { once: true, signal });

    animation.addEventListener(
      'finish',
      () => {
        cleanup();

        if (name) {
          details.setAttribute('name', details.getAttribute('data-disclosure-name') ?? '');
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

  #createBinding(details: HTMLDetailsElement, summary: HTMLElement, content: HTMLElement) {
    return { details, summary, content, timer: undefined, animation: null };
  }

  #getActiveElement() {
    let active = document.activeElement;

    while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }

    return active instanceof HTMLElement ? active : null;
  }

  #isFocusable(element: HTMLElement) {
    return element.getAttribute('aria-disabled') !== 'true';
  }

  #waitAnimation(animation: Animation) {
    const { playState } = animation;

    if (playState === 'idle' || playState === 'finished') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const done = () => {
        resolve();
      };

      animation.addEventListener('cancel', done, { once: true });
      animation.addEventListener('finish', done, { once: true });
    });
  }
}

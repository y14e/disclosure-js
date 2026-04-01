interface DisclosureOptions {
  animation: {
    duration: number;
    easing: string;
  };
}

export default class Disclosure {
  private rootElement!: HTMLElement;
  private defaults!: DisclosureOptions;
  private settings!: DisclosureOptions;
  private detailsElements!: HTMLDetailsElement[];
  private summaryElements!: HTMLElement[];
  private contentElements!: HTMLElement[];
  private animations!: (Animation | null)[];
  private observers!: MutationObserver[];
  private controller!: AbortController;
  private destroyed!: boolean;

  constructor(root: HTMLElement, options: Partial<DisclosureOptions> = {}) {
    if (!root) return;
    this.rootElement = root;
    this.defaults = {
      animation: {
        duration: 300,
        easing: 'ease',
      },
    };
    this.settings = { animation: { ...this.defaults.animation, ...options.animation } };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.animation.duration = 0;
    }
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = [...this.rootElement.querySelectorAll<HTMLDetailsElement>(`details${NOT_NESTED}`)];
    this.summaryElements = [...this.rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED}`)];
    this.contentElements = [...this.rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED} + *`)];
    this.animations = Array(this.detailsElements.length).fill(null);
    this.controller = new AbortController();
    this.destroyed = false;
    this.handleSummaryClick = this.handleSummaryClick.bind(this);
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  private initialize(): void {
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) return;
    const { signal } = this.controller;
    this.detailsElements.forEach((details) => {
      if (details.name) {
        details.setAttribute('data-disclosure-name', details.name);
      }
      const setData = (): void => {
        details.toggleAttribute('data-disclosure-open', details.open);
      };
      const observer = new MutationObserver(setData);
      observer.observe(details, { attributeFilter: ['open'] });
      this.observers.push(observer);
      setData();
    });
    this.summaryElements.forEach((summary, i) => {
      if (!this.isFocusable(this.detailsElements[i])) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('click', this.handleSummaryClick, { signal });
      summary.addEventListener('keydown', this.handleSummaryKeyDown, { signal });
    });
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  private getActiveElement(): HTMLElement | null {
    let active = document.activeElement;
    while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active instanceof HTMLElement ? active : null;
  }

  private isFocusable(element: HTMLElement): boolean {
    return element.getAttribute('aria-disabled') !== 'true';
  }

  private toggle(details: HTMLDetailsElement, open: boolean): void {
    if (open === details.hasAttribute('data-disclosure-open')) return;
    const name = details.getAttribute('data-disclosure-name');
    if (name) {
      details.removeAttribute('name');
      const current = this.rootElement.querySelector<HTMLDetailsElement>(`details[data-disclosure-name="${name}"][data-disclosure-open]`);
      if (open && current && current !== details) {
        this.close(current);
      }
    }
    const index = this.detailsElements.indexOf(details);
    const content = this.contentElements[index];
    const style = getComputedStyle(content);
    const startSize = details.open ? style.getPropertyValue('block-size') : '0';
    let animation = this.animations[index];
    animation?.cancel();
    if (open) {
      details.open = true;
    }
    const endSize = open ? parseFloat(style.getPropertyValue('block-size')) : 0;
    requestAnimationFrame(() => details.toggleAttribute('data-disclosure-open', open));
    content.style.setProperty('overflow', 'clip');
    animation = content.animate(
      { blockSize: [startSize, `${Math.max(parseFloat(style.getPropertyValue('min-block-size')), Math.min(endSize, parseFloat(style.getPropertyValue('max-block-size')) || endSize))}px`] },
      {
        duration: this.settings.animation.duration,
        easing: this.settings.animation.easing,
      },
    );
    this.animations[index] = animation;
    const cleanupAnimation = () => {
      if (this.animations[index] === animation) {
        this.animations[index] = null;
      }
    };
    animation.addEventListener('cancel', cleanupAnimation);
    animation.addEventListener('finish', () => {
      cleanupAnimation();
      if (name) {
        details.setAttribute('name', details.getAttribute('data-disclosure-name') ?? '');
      }
      if (!open) {
        details.open = false;
      }
      ['block-size', 'overflow'].forEach((name) => content.style.removeProperty(name));
    });
  }

  private handleSummaryClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const summary = event.currentTarget;
    if (!(summary instanceof HTMLElement)) return;
    const details = this.detailsElements[this.summaryElements.indexOf(summary)];
    this.toggle(details, !details.hasAttribute('data-disclosure-open'));
  }

  private handleSummaryKeyDown(event: KeyboardEvent): void {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const focusables = this.summaryElements.filter((_, i) => this.isFocusable(this.detailsElements[i]));
    const active = this.getActiveElement();
    if (!active) return;
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
  }

  open(details: HTMLDetailsElement): void {
    if (this.detailsElements.includes(details)) {
      this.toggle(details, true);
    }
  }

  close(details: HTMLDetailsElement): void {
    if (this.detailsElements.includes(details)) {
      this.toggle(details, false);
    }
  }

  async destroy(force = false): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.rootElement.removeAttribute('data-disclosure-initialized');
    this.controller.abort();
    this.observers.forEach((observer) => observer.disconnect());
    if (!force) {
      await Promise.all(this.animations.map((animation) => animation?.finished.catch(() => {})));
    }
    this.animations.forEach((animation) => animation?.cancel());
  }
}

type DisclosureOptions = {
  animation: {
    duration: number;
    easing: string;
  };
};

export class Disclosure {
  private rootElement!: HTMLElement;
  private defaults!: DisclosureOptions;
  private settings!: DisclosureOptions;
  private detailsElements!: HTMLDetailsElement[];
  private summaryElements!: HTMLElement[];
  private contentElements!: HTMLElement[];
  private animations!: (Animation | null)[];

  constructor(root: HTMLElement, options?: Partial<DisclosureOptions>) {
    if (!root) {
      return;
    }
    this.rootElement = root;
    this.defaults = {
      animation: {
        duration: 300,
        easing: 'ease',
      },
    };
    this.settings = {
      animation: { ...this.defaults.animation, ...options?.animation },
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.animation.duration = 0;
    }
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = [...this.rootElement.querySelectorAll(`details${NOT_NESTED}`)] as HTMLDetailsElement[];
    this.summaryElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED}`)] as HTMLElement[];
    this.contentElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`)] as HTMLElement[];
    this.animations = Array(this.detailsElements.length).fill(null);
    this.handleSummaryClick = this.handleSummaryClick.bind(this);
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  private initialize(): void {
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) {
      return;
    }
    this.detailsElements.forEach(details => {
      if (details.name) {
        details.setAttribute('data-disclosure-name', details.name);
      }
      function setData(): void {
        details.toggleAttribute('data-disclosure-open', details.open);
      }
      new MutationObserver(setData).observe(details, {
        attributeFilter: ['open'],
      });
      setData();
    });
    this.summaryElements.forEach((summary, i) => {
      if (!this.isFocusable(this.detailsElements[i])) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('click', this.handleSummaryClick);
      summary.addEventListener('keydown', this.handleSummaryKeyDown);
    });
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  private getActiveElement(): HTMLElement | null {
    let active: Element | null = document.activeElement;
    while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active instanceof HTMLElement ? active : null;
  }

  private isFocusable(element: HTMLElement): boolean {
    return element.getAttribute('aria-disabled') !== 'true';
  }

  private toggle(details: HTMLDetailsElement, open: boolean): void {
    if (open === details.hasAttribute('data-disclosure-open')) {
      return;
    }
    const name = details.getAttribute('data-disclosure-name');
    if (name) {
      details.removeAttribute('name');
      const current = this.rootElement.querySelector(`details[data-disclosure-name="${name}"][data-disclosure-open]`) as HTMLDetailsElement;
      if (open && current && current !== details) {
        this.close(current);
      }
    }
    const index = this.detailsElements.indexOf(details);
    const content = this.contentElements[index];
    const computed = window.getComputedStyle(content);
    const size = details.open ? computed.getPropertyValue('block-size') : '0';
    let animation = this.animations[index];
    if (animation) {
      animation.cancel();
    }
    if (open) {
      details.open = true;
    }
    window.requestAnimationFrame(() => {
      details.toggleAttribute('data-disclosure-open', open);
    });
    content.style.setProperty('overflow', 'clip');
    animation = this.animations[index] = content.animate(
      {
        blockSize: [size, open ? computed.getPropertyValue('block-size') : '0'],
      },
      {
        duration: this.settings.animation.duration,
        easing: this.settings.animation.easing,
      },
    );
    animation.addEventListener('finish', () => {
      this.animations[index] = null;
      if (name) {
        details.setAttribute('name', details.getAttribute('data-disclosure-name')!);
      }
      if (!open) {
        details.open = false;
      }
      ['block-size', 'overflow'].forEach(name => content.style.removeProperty(name));
    });
  }

  private handleSummaryClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const details = this.detailsElements[this.summaryElements.indexOf(event.currentTarget as HTMLElement)];
    this.toggle(details, !details.hasAttribute('data-disclosure-open'));
  }

  private handleSummaryKeyDown(event: KeyboardEvent): void {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const focusables = this.summaryElements.filter((_, i) => this.isFocusable(this.detailsElements[i]));
    const length = focusables.length;
    const active = this.getActiveElement();
    const current = active instanceof HTMLElement ? active : null;
    if (!current) {
      return;
    }
    const currentIndex = focusables.indexOf(current);
    let newIndex!: number;
    switch (key) {
      case 'End':
        newIndex = length - 1;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'ArrowUp':
        newIndex = (currentIndex - 1 + length) % length;
        break;
      case 'ArrowDown':
        newIndex = (currentIndex + 1) % length;
        break;
    }
    focusables[newIndex].focus();
  }

  open(details: HTMLDetailsElement): void {
    if (!this.detailsElements.includes(details)) {
      return;
    }
    this.toggle(details, true);
  }

  close(details: HTMLDetailsElement): void {
    if (!this.detailsElements.includes(details)) {
      return;
    }
    this.toggle(details, false);
  }
}

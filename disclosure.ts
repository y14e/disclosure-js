type DisclosureOptions = {
  animation: {
    duration: number;
    easing: string;
  };
};

class Disclosure {
  rootElements: HTMLElement;
  defaults: DisclosureOptions;
  settings: DisclosureOptions;
  detailsElements: NodeListOf<HTMLDetailsElement>;
  summaryElements: NodeListOf<HTMLElement>;
  contentElements: NodeListOf<HTMLElement>;
  animations: (Animation | null)[] = [];

  constructor(root: HTMLElement, options?: Partial<DisclosureOptions>) {
    this.rootElements = root;
    this.defaults = {
      animation: {
        duration: 300,
        easing: 'ease',
      },
    };
    this.settings = {
      animation: { ...this.defaults.animation, ...options?.animation },
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.settings.animation.duration = 0;
    let NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = this.rootElements.querySelectorAll(`details${NOT_NESTED}`);
    this.summaryElements = this.rootElements.querySelectorAll(`summary${NOT_NESTED}`);
    this.contentElements = this.rootElements.querySelectorAll(`summary${NOT_NESTED} + *`);
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) return;
    this.animations = Array(this.detailsElements.length).fill(null);
    this.initialize();
  }

  private initialize(): void {
    this.detailsElements.forEach(details => {
      if (details.hasAttribute('name')) details.setAttribute('data-disclosure-name', details.getAttribute('name')!);
      let setData = (): void => details.setAttribute('data-disclosure-open', String(details.hasAttribute('open')));
      new MutationObserver(setData).observe(details, { attributeFilter: ['open'] });
      setData();
    });
    this.summaryElements.forEach(summary => {
      if (!this.isFocusable(summary.parentElement!)) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('click', event => this.handleSummaryClick(event));
      summary.addEventListener('keydown', event => this.handleSummaryKeyDown(event));
    });
    this.contentElements.forEach(content => {
      if (!this.isFocusable(content.parentElement!)) content.setAttribute('hidden', '');
    });
    this.rootElements.setAttribute('data-disclosure-initialized', '');
  }

  private isFocusable(element: HTMLElement): boolean {
    return element.getAttribute('aria-disabled') !== 'true' && !element.hasAttribute('disabled');
  }

  private toggle(details: HTMLDetailsElement, isOpen: boolean): void {
    let name = details.getAttribute('data-disclosure-name');
    if (name) {
      details.removeAttribute('name');
      let opened = document.querySelector(`details[data-disclosure-name="${name}"][data-disclosure-open="true"]`) as HTMLDetailsElement;
      if (isOpen && opened && opened !== details) this.close(opened);
    }
    window.requestAnimationFrame(() => details.setAttribute('data-disclosure-open', String(isOpen)));
    let height = `${details.offsetHeight}px`;
    if (isOpen) details.setAttribute('open', '');
    details.style.setProperty('overflow', 'clip');
    let index = [...this.detailsElements].indexOf(details);
    let animation = this.animations[index];
    if (animation) animation.cancel();
    let content = details.querySelector('summary + *')!;
    content.removeAttribute('hidden');
    animation = this.animations[index] = details.animate({ height: [height, `${details.querySelector('summary')!.scrollHeight + (isOpen ? content.scrollHeight : 0)}px`] }, { duration: this.settings.animation.duration, easing: this.settings.animation.easing });
    animation.addEventListener('finish', () => {
      this.animations[index] = null;
      if (name) details.setAttribute('name', details.getAttribute('data-disclosure-name')!);
      if (!isOpen) details.removeAttribute('open');
      ['height', 'overflow'].forEach(name => details.style.removeProperty(name));
    });
  }

  private handleSummaryClick(event: MouseEvent): void {
    event.preventDefault();
    let details = (event.currentTarget as HTMLDetailsElement).parentElement as HTMLDetailsElement;
    this.toggle(details, details.getAttribute('data-disclosure-open') !== 'true');
  }

  private handleSummaryKeyDown(event: KeyboardEvent): void {
    let { key } = event;
    if (!['ArrowUp', 'ArrowDown', 'End', 'Home'].includes(key)) return;
    event.preventDefault();
    let focusables = [...this.summaryElements].filter(summary => this.isFocusable(summary.parentElement!));
    let currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
    let length = focusables.length;
    let newIndex = 0;
    switch (key) {
      case 'ArrowUp':
        newIndex = (currentIndex - 1 + length) % length;
        break;
      case 'ArrowDown':
        newIndex = (currentIndex + 1) % length;
        break;
      case 'End':
        newIndex = length - 1;
        break;
    }
    focusables[newIndex].focus();
  }

  open(details: HTMLDetailsElement): void {
    if (details.getAttribute('data-disclosure-open') === 'true') return;
    this.toggle(details, true);
  }

  close(details: HTMLDetailsElement): void {
    if (details.getAttribute('data-disclosure-open') === 'false') return;
    this.toggle(details, false);
  }
}

export default Disclosure;

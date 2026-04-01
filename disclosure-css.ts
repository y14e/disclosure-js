export default class Disclosure {
  private rootElement!: HTMLElement;
  private detailsElements!: HTMLDetailsElement[];
  private summaryElements!: HTMLElement[];
  private contentElements!: HTMLElement[];
  private controller!: AbortController;
  private destroyed!: boolean;

  constructor(root: HTMLElement) {
    if (!root) return;
    this.rootElement = root;
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = [...this.rootElement.querySelectorAll<HTMLDetailsElement>(`details${NOT_NESTED}`)];
    this.summaryElements = [...this.rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED}`)];
    this.contentElements = [...this.rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED} + *`)];
    this.controller = new AbortController();
    this.destroyed = false;
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  private initialize(): void {
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) return;
    const { signal } = this.controller;
    this.summaryElements.forEach((summary, i) => {
      if (!this.isFocusable(this.detailsElements[i])) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
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
    if (open !== details.open) details.open = open;
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

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.rootElement.removeAttribute('data-disclosure-initialized');
    this.controller.abort();
  }
}

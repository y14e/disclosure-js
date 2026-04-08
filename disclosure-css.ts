type DisclosureBinding = {
  details: HTMLDetailsElement;
  summary: HTMLElement;
  content: HTMLElement;
};

export default class Disclosure {
  private readonly rootElement: HTMLElement;
  private readonly detailsElements: NodeListOf<HTMLDetailsElement>;
  private readonly summaryElements: NodeListOf<HTMLElement>;
  private readonly contentElements: NodeListOf<HTMLElement>;
  private readonly bindingMap: WeakMap<HTMLElement, DisclosureBinding> = new WeakMap();
  private readonly eventController = new AbortController();
  private destroyed = false;

  constructor(root: HTMLElement) {
    if (!root) throw new Error('Root element missing');
    this.rootElement = root;
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = this.rootElement.querySelectorAll<HTMLDetailsElement>(`details${NOT_NESTED}`);
    this.summaryElements = this.rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED}`);
    this.contentElements = this.rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED} + *`);
    if (this.detailsElements.length === 0 || this.summaryElements.length === 0 || this.contentElements.length === 0) throw new Error('Details, summary, or content element missing');
    this.initialize();
  }

  open(details: HTMLDetailsElement): void {
    if (this.bindingMap.has(details)) {
      this.toggle(details, true);
    }
  }

  close(details: HTMLDetailsElement): void {
    if (this.bindingMap.has(details)) {
      this.toggle(details, false);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.eventController.abort();
    this.rootElement.removeAttribute('data-disclosure-initialized');
  }

  private initialize(): void {
    const { signal } = this.eventController;
    for (let i = 0, l = this.summaryElements.length; i < l; i++) {
      const summary = this.summaryElements[i];
      const details = this.detailsElements[i];
      if (!this.isFocusable(details)) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('keydown', this.handleSummaryKeyDown, { signal });
    }
    for (let i = 0, l = this.detailsElements.length; i < l; i++) {
      const details = this.detailsElements[i];
      const summary = this.summaryElements[i];
      const content = this.contentElements[i];
      if (!summary || !content) continue;
      const binding = this.createBinding(details, summary, content);
      this.bindingMap.set(details, binding);
      this.bindingMap.set(summary, binding);
      this.bindingMap.set(content, binding);
    }
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  private handleSummaryKeyDown = (event: KeyboardEvent): void => {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const focusables: HTMLElement[] = [];
    for (const summary of this.summaryElements) {
      const binding = this.bindingMap.get(summary);
      if (binding && this.isFocusable(binding.details)) {
        focusables.push(summary);
      }
    }
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
  };

  private toggle(details: HTMLDetailsElement, open: boolean): void {
    if (open !== details.open) {
      details.open = open;
    }
  }

  private createBinding(details: HTMLDetailsElement, summary: HTMLElement, content: HTMLElement): DisclosureBinding {
    return { details, summary, content };
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
}

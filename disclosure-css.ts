export class Disclosure {
  private rootElement!: HTMLElement;
  private detailsElements!: HTMLDetailsElement[];
  private summaryElements!: HTMLElement[];
  private contentElements!: HTMLElement[];

  constructor(root: HTMLElement) {
    if (!root) {
      return;
    }
    this.rootElement = root;
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = [...this.rootElement.querySelectorAll(`details${NOT_NESTED}`)] as HTMLDetailsElement[];
    this.summaryElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED}`)] as HTMLElement[];
    this.contentElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`)] as HTMLElement[];
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  private initialize(): void {
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) {
      return;
    }
    this.summaryElements.forEach(summary => {
      if (!this.isFocusable(summary.parentElement!)) {
        summary.tabIndex = -1;
        summary.style.setProperty('pointer-events', 'none');
      }
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
    return element.ariaDisabled !== 'true';
  }

  private toggle(details: HTMLDetailsElement, open: boolean): void {
    if (open === details.open) {
      return;
    }
    details.open = open;
  }

  private handleSummaryKeyDown(event: KeyboardEvent): void {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const focusables = this.summaryElements.filter(summary => this.isFocusable(summary.parentElement!));
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

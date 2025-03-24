class Disclosure {
  rootElement: HTMLElement;
  detailsElements: NodeListOf<HTMLDetailsElement>;
  summaryElements: NodeListOf<HTMLElement>;
  contentElements: NodeListOf<HTMLElement>;

  constructor(root: HTMLElement) {
    this.rootElement = root;
    let NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = this.rootElement.querySelectorAll(`details${NOT_NESTED}`);
    this.summaryElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED}`);
    this.contentElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`);
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) return;
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  private initialize(): void {
    this.summaryElements.forEach(summary => {
      if (!this.isFocusable(summary.parentElement!)) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('keydown', this.handleSummaryKeyDown);
    });
    this.contentElements.forEach(content => {
      if (!this.isFocusable(content.parentElement!)) content.setAttribute('hidden', '');
    });
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  private isFocusable(element: HTMLElement): boolean {
    return element.getAttribute('aria-disabled') !== 'true' && !element.hasAttribute('disabled');
  }

  private toggle(details: HTMLDetailsElement, isOpen: boolean): void {
    if (isOpen) {
      details.setAttribute('open', '');
    } else {
      details.removeAttribute('open');
    }
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
    if (details.hasAttribute('open')) return;
    this.toggle(details, true);
  }

  close(details: HTMLDetailsElement): void {
    if (!details.hasAttribute('open')) return;
    this.toggle(details, false);
  }
}

export default Disclosure;

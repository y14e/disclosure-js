export class Disclosure {
  constructor(root) {
    if (!root) {
      return;
    }
    this.rootElement = root;
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = [...this.rootElement.querySelectorAll(`details${NOT_NESTED}`)];
    this.summaryElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED}`)];
    this.contentElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`)];
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  initialize() {
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) {
      return;
    }
    this.summaryElements.forEach((summary, i) => {
      if (!this.isFocusable(this.detailsElements[i])) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('keydown', this.handleSummaryKeyDown);
    });
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  getActiveElement() {
    let active = document.activeElement;
    while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active instanceof HTMLElement ? active : null;
  }

  isFocusable(element) {
    return element.getAttribute('aria-disabled') !== 'true';
  }

  toggle(summary, open) {
    const details = this.detailsElements[this.summaryElements.indexOf(summary)];
    if (open === details.hasAttribute('open')) {
      return;
    }
    details.toggleAttribute('open', open);
  }

  handleSummaryKeyDown(event) {
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
    let newIndex;
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

  open(summary) {
    if (!this.summaryElements.includes(summary)) {
      return;
    }
    this.toggle(summary, true);
  }

  close(summary) {
    if (!this.summaryElements.includes(summary)) {
      return;
    }
    this.toggle(summary, false);
  }
}

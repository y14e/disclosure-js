export default class Disclosure {
  constructor(root) {
    if (!root) return;
    this.rootElement = root;
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = this.rootElement.querySelectorAll(`details${NOT_NESTED}`);
    this.summaryElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED}`);
    this.contentElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`);
    this.entries = new WeakMap();
    this.controller = new AbortController();
    this.destroyed = false;
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  initialize() {
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) return;
    const { signal } = this.controller;
    this.summaryElements.forEach((summary, i) => {
      const details = this.detailsElements[i];
      if (!this.isFocusable(details)) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('keydown', this.handleSummaryKeyDown, { signal });
    });
    this.detailsElements.forEach((details, i) => {
      const summary = this.summaryElements[i];
      const content = this.contentElements[i];
      if (!summary || !content) return;
      const entry = { animation: null, content, details, summary };
      this.entries.set(details, entry);
      this.entries.set(summary, entry);
      this.entries.set(content, entry);
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

  toggle(details, open) {
    if (open !== details.open) {
      details.open = open;
    }
  }

  handleSummaryKeyDown(event) {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const focusables = [];
    this.summaryElements.forEach((summary) => {
      const entry = this.entries.get(summary);
      if (entry && this.isFocusable(entry.details)) {
        focusables.push(summary);
      }
    });
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

  open(details) {
    if (this.entries.has(details)) {
      this.toggle(details, true);
    }
  }

  close(details) {
    if (this.entries.has(details)) {
      this.toggle(details, false);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.rootElement.removeAttribute('data-disclosure-initialized');
    this.controller.abort();
  }
}

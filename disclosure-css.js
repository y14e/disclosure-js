export default class Disclosure {
  constructor(root) {
    if (!root) throw new Error('Root element missing');
    this.rootElement = root;
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = this.rootElement.querySelectorAll(`details${NOT_NESTED}`);
    this.summaryElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED}`);
    this.contentElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`);
    if (this.detailsElements.length === 0 || this.summaryElements.length === 0 || this.contentElements.length === 0) throw new Error('Details, summary, or content element missing');
    this.bindingMap = new WeakMap();
    this.eventController = new AbortController();
    this.destroyed = false;
    this.initialize();
  }

  open(details) {
    if (this.bindingMap.has(details)) {
      this.toggle(details, true);
    }
  }

  close(details) {
    if (this.bindingMap.has(details)) {
      this.toggle(details, false);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.eventController.abort();
    this.rootElement.removeAttribute('data-disclosure-initialized');
  }

  initialize() {
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

  handleSummaryKeyDown = (event) => {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const focusables = [];
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

  toggle(details, open) {
    if (open !== details.open) {
      details.open = open;
    }
  }

  createBinding(details, summary, content) {
    return { details, summary, content };
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
}

export default class Disclosure {
  constructor(root) {
    if (!root) return;
    this.rootElement = root;
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = [...this.rootElement.querySelectorAll(`details${NOT_NESTED}`)];
    this.summaryElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED}`)];
    this.contentElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`)];
    this.eventController = new AbortController();
    this.destroyed = false;
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  initialize() {
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) return;
    const { signal } = this.eventController;
    this.summaryElements.forEach((summary, i) => {
      if (!this.isFocusable(this.detailsElements[i])) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('keydown', this.handleSummaryKeyDown, { signal });
    });
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  getActiveElement() {
    let active = document.activeElement;
    while (active && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  }

  isFocusable(element) {
    return element.getAttribute('aria-disabled') !== 'true';
  }

  toggle(details, open) {
    if (open !== details.open) details.open = open;
  }

  handleSummaryKeyDown(event) {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const focusables = this.summaryElements.filter((_, i) => this.isFocusable(this.detailsElements[i]));
    const length = focusables.length;
    const currentIndex = focusables.indexOf(this.getActiveElement());
    let newIndex = currentIndex;
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

  open(details) {
    if (this.detailsElements.includes(details)) this.toggle(details, true);
  }

  close(details) {
    if (this.detailsElements.includes(details)) this.toggle(details, false);
  }

  destroy() {
    if (this.destroyed) return;
    this.rootElement.removeAttribute('data-disclosure-initialized');
    this.eventController.abort();
    this.destroyed = true;
  }
}

class Disclosure {
  constructor(root) {
    this.rootElement = root;
    let NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = this.rootElement.querySelectorAll(`details${NOT_NESTED}`);
    this.summaryElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED}`);
    this.contentElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`);
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) return;
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  initialize() {
    this.summaryElements.forEach(summary => {
      if (!this.isFocusable(summary.parentElement)) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('keydown', this.handleSummaryKeyDown);
    });
    this.contentElements.forEach(content => {
      if (!this.isFocusable(content.parentElement)) content.setAttribute('hidden', '');
    });
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  isFocusable(element) {
    return element.getAttribute('aria-disabled') !== 'true' && !element.hasAttribute('disabled');
  }

  toggle(details, isOpen) {
    if (isOpen) {
      details.setAttribute('open', '');
    } else {
      details.removeAttribute('open');
    }
  }

  handleSummaryKeyDown(event) {
    let { key } = event;
    if (!['ArrowUp', 'ArrowDown', 'End', 'Home'].includes(key)) return;
    event.preventDefault();
    let focusables = [...this.summaryElements].filter(summary => this.isFocusable(summary.parentElement));
    let currentIndex = focusables.indexOf(document.activeElement);
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

  open(details) {
    if (details.hasAttribute('open')) return;
    this.toggle(details, true);
  }

  close(details) {
    if (!details.hasAttribute('open')) return;
    this.toggle(details, false);
  }
}

export default Disclosure;

type DisclosureBinding = {
  details: HTMLDetailsElement;
  summary: HTMLElement;
  content: HTMLElement;
};

export default class Disclosure {
  #rootElement: HTMLElement;
  #detailsElements: NodeListOf<HTMLDetailsElement> | null;
  #summaryElements: NodeListOf<HTMLElement> | null;
  #contentElements: NodeListOf<HTMLElement> | null;
  #bindings: WeakMap<HTMLElement, DisclosureBinding> | null = new WeakMap();
  #controller: AbortController | null = new AbortController();
  #isDestroyed = false;

  constructor(root: HTMLElement) {
    if (!root) {
      throw new Error('Root element missing.');
    }

    this.#rootElement = root;
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.#detailsElements = this.#rootElement.querySelectorAll<HTMLDetailsElement>(`details${NOT_NESTED}`);
    this.#summaryElements = this.#rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED}`);
    this.#contentElements = this.#rootElement.querySelectorAll<HTMLElement>(`summary${NOT_NESTED} + *`);

    if (
      this.#detailsElements.length === 0 ||
      this.#summaryElements.length === 0 ||
      this.#contentElements.length === 0
    ) {
      throw new Error('Details, summary, or content element missing.');
    }

    this.#initialize();
  }

  open(details: HTMLDetailsElement): void {
    if (!this.#isDestroyed && this.#bindings?.has(details)) {
      this.#toggle(details, true);
    }
  }

  close(details: HTMLDetailsElement): void {
    if (!this.#isDestroyed && this.#bindings?.has(details)) {
      this.#toggle(details, false);
    }
  }

  destroy(): void {
    if (this.#isDestroyed) {
      return;
    }

    this.#isDestroyed = true;
    this.#controller?.abort();
    this.#controller = null;
    this.#rootElement.removeAttribute('data-disclosure-initialized');
    this.#detailsElements = null;
    this.#summaryElements = null;
    this.#contentElements = null;
    this.#bindings = null;
  }

  #initialize(): void {
    if (
      !this.#detailsElements ||
      !this.#summaryElements ||
      !this.#contentElements ||
      !this.#bindings ||
      !this.#controller
    ) {
      return;
    }

    const { signal } = this.#controller;

    for (let i = 0, l = this.#summaryElements.length; i < l; i++) {
      const summary = this.#summaryElements[i] as HTMLElement;
      const details = this.#detailsElements[i] as HTMLDetailsElement;

      if (!this.#isFocusable(details)) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }

      summary.addEventListener('keydown', this.#onSummaryKeyDown, { signal });
    }
    for (let i = 0, l = this.#detailsElements.length; i < l; i++) {
      const details = this.#detailsElements[i] as HTMLDetailsElement;
      const summary = this.#summaryElements[i];
      const content = this.#contentElements[i];

      if (!summary || !content) {
        continue;
      }

      const binding = this.#createBinding(details, summary, content);
      this.#bindings.set(details, binding);
      this.#bindings.set(summary, binding);
      this.#bindings.set(content, binding);
    }
    this.#rootElement.setAttribute('data-disclosure-initialized', '');
  }

  #onSummaryKeyDown = (event: KeyboardEvent): void => {
    if (!this.#summaryElements) {
      return;
    }

    const { key } = event;

    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const focusables: HTMLElement[] = [];

    for (const summary of this.#summaryElements) {
      const binding = this.#bindings?.get(summary);

      if (binding && this.#isFocusable(binding.details)) {
        focusables.push(summary);
      }
    }

    const active = this.#getActiveElement();

    if (!active) {
      return;
    }

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

  #toggle(details: HTMLDetailsElement, isOpen: boolean): void {
    if (isOpen !== details.open) {
      details.open = isOpen;
    }
  }

  #createBinding(details: HTMLDetailsElement, summary: HTMLElement, content: HTMLElement): DisclosureBinding {
    return { details, summary, content };
  }

  #getActiveElement(): HTMLElement | null {
    let active = document.activeElement;

    while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }

    return active instanceof HTMLElement ? active : null;
  }

  #isFocusable(element: HTMLElement): boolean {
    return element.getAttribute('aria-disabled') !== 'true';
  }
}

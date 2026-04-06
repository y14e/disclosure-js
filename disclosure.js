export default class Disclosure {
  constructor(root, options = {}) {
    if (!root) throw new Error('Root element missing');
    this.rootElement = root;
    this.defaults = {
      animation: {
        duration: 300,
        easing: 'ease',
      },
    };
    this.settings = { animation: { ...this.defaults.animation, ...options.animation } };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.animation.duration = 0;
    }
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = this.rootElement.querySelectorAll(`details${NOT_NESTED}`);
    this.summaryElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED}`);
    this.contentElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`);
    if (this.detailsElements.length === 0 || this.summaryElements.length === 0 || this.contentElements.length === 0) throw new Error('Details, summary, or content element missing');
    this.entries = new WeakMap();
    this.observers = [];
    this.controller = new AbortController();
    this.destroyed = false;
    this.initialize();
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

  async destroy(force = false) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.controller.abort();
    this.rootElement.removeAttribute('data-disclosure-initialized');
    if (!force) {
      const promises = [];
      for (const details of this.detailsElements) {
        const entry = this.entries.get(details);
        if (entry?.animation) {
          promises.push(entry.animation.finished.catch(() => {}).then(() => {}));
        }
      }
      await Promise.all(promises);
    }
    for (const details of this.detailsElements) {
      this.entries.get(details)?.animation?.cancel();
    }
  }

  initialize() {
    const { signal } = this.controller;
    for (const details of this.detailsElements) {
      if (details.name) {
        details.setAttribute('data-disclosure-name', details.name);
      }
      const sync = () => {
        details.toggleAttribute('data-disclosure-open', details.open);
      };
      const observer = new MutationObserver(sync);
      observer.observe(details, { attributeFilter: ['open'] });
      this.observers.push(observer);
      sync();
    }
    for (let i = 0, l = this.summaryElements.length; i < l; i++) {
      const summary = this.summaryElements[i];
      if (!this.isFocusable(this.detailsElements[i])) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('click', this.handleSummaryClick, { signal });
      summary.addEventListener('keydown', this.handleSummaryKeyDown, { signal });
    }
    for (let i = 0, l = this.detailsElements.length; i < l; i++) {
      const details = this.detailsElements[i];
      const summary = this.summaryElements[i];
      const content = this.contentElements[i];
      if (!summary || !content) continue;
      const entry = this.createEntry(details, summary, content);
      this.entries.set(details, entry);
      this.entries.set(summary, entry);
      this.entries.set(content, entry);
    }
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  handleSummaryClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const summary = event.currentTarget;
    if (!(summary instanceof HTMLElement)) return;
    const entry = this.entries.get(summary);
    if (!entry) return;
    const { details } = entry;
    this.toggle(details, !details.hasAttribute('data-disclosure-open'));
  };

  handleSummaryKeyDown = (event) => {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const focusables = [];
    for (const summary of this.summaryElements) {
      const entry = this.entries.get(summary);
      if (entry && this.isFocusable(entry.details)) {
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
    const entry = this.entries.get(details);
    if (!entry) return;
    if (open === details.hasAttribute('data-disclosure-open')) return;
    const name = details.getAttribute('data-disclosure-name');
    if (name) {
      details.removeAttribute('name');
      const current = this.rootElement.querySelector(`details[data-disclosure-name="${name}"][data-disclosure-open]`);
      if (open && current && current !== details) {
        this.close(current);
      }
    }
    const { content } = entry;
    const startSize = details.open ? content.offsetHeight : 0;
    let { animation } = entry;
    animation?.cancel();
    if (open) {
      details.open = true;
    }
    const endSize = open ? content.scrollHeight : 0;
    requestAnimationFrame(() => details.toggleAttribute('data-disclosure-open', open));
    content.style.setProperty('overflow', 'clip');
    const { duration, easing } = this.settings.animation;
    animation = content.animate({ blockSize: [`${startSize}px`, `${endSize}px`] }, { duration, easing });
    entry.animation = animation;
    const cleanupAnimation = () => {
      if (entry.animation === animation) {
        entry.animation = null;
      }
    };
    animation.addEventListener('cancel', cleanupAnimation);
    animation.addEventListener('finish', () => {
      cleanupAnimation();
      if (name) {
        details.setAttribute('name', details.getAttribute('data-disclosure-name') ?? '');
      }
      if (!open) {
        details.open = false;
      }
      ['block-size', 'overflow'].forEach((prop) => content.style.removeProperty(prop));
    });
  }

  createEntry(details, summary, content) {
    return { details, summary, content, animation: null };
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

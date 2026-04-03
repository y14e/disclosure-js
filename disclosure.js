export default class Disclosure {
  constructor(root, options = {}) {
    if (!root) return;
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
    this.entries = new WeakMap();
    this.controller = new AbortController();
    this.observers = [];
    this.destroyed = false;
    this.handleSummaryClick = this.handleSummaryClick.bind(this);
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  initialize() {
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) return;
    const { signal } = this.controller;
    this.detailsElements.forEach((details) => {
      if (details.name) {
        details.setAttribute('data-disclosure-name', details.name);
      }
      const setData = () => {
        details.toggleAttribute('data-disclosure-open', details.open);
      };
      const observer = new MutationObserver(setData);
      observer.observe(details, { attributeFilter: ['open'] });
      this.observers.push(observer);
      setData();
    });
    this.summaryElements.forEach((summary, i) => {
      if (!this.isFocusable(this.detailsElements[i])) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('click', this.handleSummaryClick, { signal });
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
    animation = content.animate(
      { blockSize: [`${startSize}px`, `${endSize}px`] },
      {
        duration: this.settings.animation.duration,
        easing: this.settings.animation.easing,
      },
    );
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

  handleSummaryClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const summary = event.currentTarget;
    if (!(summary instanceof HTMLElement)) return;
    const entry = this.entries.get(summary);
    if (!entry) return;
    const { details } = entry;
    this.toggle(details, !details.hasAttribute('data-disclosure-open'));
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

  async destroy(force = false) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.rootElement.removeAttribute('data-disclosure-initialized');
    this.controller.abort();
    if (!force) {
      const promises = [];
      this.detailsElements.forEach((details) => {
        const entry = this.entries.get(details);
        if (entry?.animation) {
          promises.push(entry.animation.finished.catch(() => {}).then(() => {}));
        }
      });
      await Promise.all(promises);
    }
    this.detailsElements.forEach((details) => this.entries.get(details)?.animation?.cancel());
  }
}

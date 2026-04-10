export default class Disclosure {
  constructor(root, options = {}) {
    if (!root) {
      throw new Error('Root element missing.');
    }
    this.rootElement = root;
    this.defaults = {
      animation: {
        duration: 300,
        easing: 'ease',
      },
    };
    this.settings = { animation: { ...this.defaults.animation, ...(options.animation ?? {}) } };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.animation.duration = 0;
    }
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = this.rootElement.querySelectorAll(`details${NOT_NESTED}`);
    this.summaryElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED}`);
    this.contentElements = this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`);
    if (this.detailsElements.length === 0 || this.summaryElements.length === 0 || this.contentElements.length === 0) {
      throw new Error('Details, summary, or content element missing.');
    }
    this.bindingMap = new WeakMap();
    this.openAttributeObservers = [];
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

  async destroy(force = false) {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.eventController.abort();
    for (const observer of this.openAttributeObservers) {
      observer.disconnect();
    }
    for (const details of this.detailsElements) {
      details.removeAttribute('data-disclosure-name');
      details.removeAttribute('data-disclosure-open');
    }
    this.rootElement.removeAttribute('data-disclosure-initialized');
    if (!force) {
      const promises = [];
      for (const details of this.detailsElements) {
        const binding = this.bindingMap.get(details);
        if (binding?.animation) {
          promises.push(binding.animation.finished.catch(() => {}).then(() => {}));
        }
      }
      await Promise.all(promises);
    }
    for (const details of this.detailsElements) {
      this.bindingMap.get(details)?.animation?.cancel();
    }
  }

  initialize() {
    const { signal } = this.eventController;
    for (const details of this.detailsElements) {
      if (details.name) {
        details.setAttribute('data-disclosure-name', details.name);
      }
      const sync = () => {
        details.toggleAttribute('data-disclosure-open', details.open);
      };
      const observer = new MutationObserver(sync);
      observer.observe(details, { attributeFilter: ['open'] });
      this.openAttributeObservers.push(observer);
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
      if (!summary || !content) {
        continue;
      }
      const binding = this.createBinding(details, summary, content);
      this.bindingMap.set(details, binding);
      this.bindingMap.set(summary, binding);
      this.bindingMap.set(content, binding);
    }
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  toggle(details, open) {
    const binding = this.bindingMap.get(details);
    if (!binding || open === details.hasAttribute('data-disclosure-open')) {
      return;
    }
    const name = details.getAttribute('data-disclosure-name');
    if (name && open) {
      for (const d of this.detailsElements) {
        if (d !== details && d.getAttribute('data-disclosure-name') === name && d.hasAttribute('data-disclosure-open')) {
          this.close(d);
          break;
        }
      }
    }
    const { content } = binding;
    const startSize = details.open ? content.offsetHeight : 0;
    binding.animation?.cancel();
    if (open) {
      details.open = true;
    }
    const endSize = open ? content.scrollHeight : 0;
    requestAnimationFrame(() => details.toggleAttribute('data-disclosure-open', open));
    content.style.setProperty('overflow', 'clip');
    const { duration, easing } = this.settings.animation;
    const animation = content.animate({ blockSize: [`${startSize}px`, `${endSize}px`] }, { duration, easing });
    binding.animation = animation;
    const cleanup = () => {
      if (binding.animation === animation) {
        binding.animation = null;
      }
    };
    animation.addEventListener('cancel', cleanup);
    animation.addEventListener('finish', () => {
      cleanup();
      if (name) {
        details.setAttribute('name', details.getAttribute('data-disclosure-name') ?? '');
      }
      if (!open) {
        details.open = false;
      }
      content.style.removeProperty('block-size');
      content.style.removeProperty('overflow');
    });
  }

  handleSummaryClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const summary = event.currentTarget;
    if (!(summary instanceof HTMLElement)) {
      return;
    }
    const binding = this.bindingMap.get(summary);
    if (!binding) {
      return;
    }
    const { details } = binding;
    this.toggle(details, !details.hasAttribute('data-disclosure-open'));
  };

  handleSummaryKeyDown = (event) => {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) {
      return;
    }
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

  createBinding(details, summary, content) {
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

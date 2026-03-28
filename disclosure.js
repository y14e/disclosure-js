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
    this.detailsElements = [...this.rootElement.querySelectorAll(`details${NOT_NESTED}`)];
    this.summaryElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED}`)];
    this.contentElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`)];
    this.animations = Array(this.detailsElements.length).fill(null);
    this.observers = [];
    this.controller = new AbortController();
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
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  getActiveElement() {
    let active = document.activeElement;
    while (active && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  isFocusable(element) {
    return element.getAttribute('aria-disabled') !== 'true';
  }

  toggle(details, open) {
    if (open === details.hasAttribute('data-disclosure-open')) return;
    const name = details.getAttribute('data-disclosure-name');
    if (name) {
      details.removeAttribute('name');
      const current = this.rootElement.querySelector(`details[data-disclosure-name="${name}"][data-disclosure-open]`);
      if (open && current && current !== details) {
        this.close(current);
      }
    }
    const index = this.detailsElements.indexOf(details);
    const content = this.contentElements[index];
    const style = getComputedStyle(content);
    const startSize = details.open ? style.getPropertyValue('block-size') : '0';
    let animation = this.animations[index];
    animation?.cancel();
    if (open) {
      details.open = true;
    }
    const endSize = open ? parseFloat(style.getPropertyValue('block-size')) : 0;
    requestAnimationFrame(() => details.toggleAttribute('data-disclosure-open', open));
    content.style.setProperty('overflow', 'clip');
    animation = this.animations[index] = content.animate(
      { blockSize: [startSize, `${Math.max(parseFloat(style.getPropertyValue('min-block-size')), Math.min(endSize, parseFloat(style.getPropertyValue('max-block-size')) || endSize))}px`] },
      {
        duration: this.settings.animation.duration,
        easing: this.settings.animation.easing,
      },
    );
    animation.addEventListener('finish', () => {
      this.animations[index] = null;
      if (name) {
        details.setAttribute('name', details.getAttribute('data-disclosure-name') ?? '');
      }
      if (!open) {
        details.open = false;
      }
      ['block-size', 'overflow'].forEach((name) => content.style.removeProperty(name));
    });
  }

  handleSummaryClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const details = this.detailsElements[this.summaryElements.indexOf(event.currentTarget)];
    this.toggle(details, !details.hasAttribute('data-disclosure-open'));
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
    if (this.detailsElements.includes(details)) {
      this.toggle(details, true);
    }
  }

  close(details) {
    if (this.detailsElements.includes(details)) {
      this.toggle(details, false);
    }
  }

  async destroy(force = false) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.rootElement.removeAttribute('data-disclosure-initialized');
    this.controller.abort();
    this.observers.forEach((observer) => observer.disconnect());
    if (!force) {
      await Promise.all(this.animations.map((animation) => animation?.finished.catch(() => {})));
    }
    this.animations.forEach((animation) => animation?.cancel());
  }
}

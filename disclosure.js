export class Disclosure {
  constructor(root, options) {
    if (!root) {
      return;
    }
    this.rootElement = root;
    this.defaults = {
      animation: {
        duration: 300,
        easing: 'ease',
      },
    };
    this.settings = {
      animation: { ...this.defaults.animation, ...options?.animation },
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.animation.duration = 0;
    }
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = [...this.rootElement.querySelectorAll(`details${NOT_NESTED}`)];
    this.summaryElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED}`)];
    this.contentElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`)];
    this.animations = Array(this.detailsElements.length).fill(null);
    this.handleSummaryClick = this.handleSummaryClick.bind(this);
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  initialize() {
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) {
      return;
    }
    this.detailsElements.forEach(details => {
      if (details.name) {
        details.setAttribute('data-disclosure-name', details.name);
      }
      function setData() {
        details.toggleAttribute('data-disclosure-open', details.open);
      }
      new MutationObserver(setData).observe(details, {
        attributeFilter: ['open'],
      });
      setData();
    });
    this.summaryElements.forEach(summary => {
      if (!this.isFocusable(summary.parentElement)) {
        summary.tabIndex = -1;
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('click', this.handleSummaryClick);
      summary.addEventListener('keydown', this.handleSummaryKeyDown);
    });
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  isFocusable(element) {
    return element.ariaDisabled !== 'true';
  }

  toggle(details, open) {
    if (open === details.hasAttribute('data-disclosure-open')) {
      return;
    }
    const name = details.getAttribute('data-disclosure-name');
    if (name) {
      details.removeAttribute('name');
      const current = document.querySelector(`details[data-disclosure-name="${name}"][data-disclosure-open]`);
      if (open && current && current !== details) {
        this.close(current);
      }
    }
    window.requestAnimationFrame(() => {
      details.toggleAttribute('data-disclosure-open', open);
    });
    const size = window.getComputedStyle(details).getPropertyValue('block-size');
    if (open) {
      details.open = true;
    }
    details.style.setProperty('overflow', 'clip');
    const index = this.detailsElements.indexOf(details);
    let animation = this.animations[index];
    if (animation) {
      animation.cancel();
    }
    const content = details.querySelector('summary + *');
    content.removeAttribute('hidden');
    animation = this.animations[index] = details.animate(
      {
        blockSize: [size, `${parseInt(window.getComputedStyle(details.querySelector('summary')).getPropertyValue('block-size')) + (open ? parseInt(window.getComputedStyle(content).getPropertyValue('block-size')) : 0)}px`],
      },
      {
        duration: this.settings.animation.duration,
        easing: this.settings.animation.easing,
      },
    );
    animation.addEventListener('finish', () => {
      this.animations[index] = null;
      if (name) {
        details.name = details.getAttribute('data-disclosure-name');
      }
      if (!open) {
        details.open = false;
      }
      ['block-size', 'overflow'].forEach(name => details.style.removeProperty(name));
    });
  }

  handleSummaryClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const details = event.currentTarget.parentElement;
    this.toggle(details, !details.hasAttribute('data-disclosure-open'));
  }

  handleSummaryKeyDown(event) {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const focusables = this.summaryElements.filter(summary => this.isFocusable(summary.parentElement));
    const length = focusables.length;
    const active = document.activeElement;
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

  open(details) {
    if (!this.detailsElements.includes(details)) {
      return;
    }
    this.toggle(details, true);
  }

  close(details) {
    if (!this.detailsElements.includes(details)) {
      return;
    }
    this.toggle(details, false);
  }
}

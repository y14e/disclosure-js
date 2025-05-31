export class Disclosure {
  constructor(root, options) {
    this.rootElement = root;
    this.defaults = {
      animation: {
        duration: 300,
        easing: 'ease',
      },
    };
    this.settings = {
      animation: {
        ...this.defaults.animation,
        ...options?.animation,
      },
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.animation.duration = 0;
    }
    const NOT_NESTED = ':not(:scope summary + * *)';
    this.detailsElements = [...this.rootElement.querySelectorAll(`details${NOT_NESTED}`)];
    this.summaryElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED}`)];
    this.contentElements = [...this.rootElement.querySelectorAll(`summary${NOT_NESTED} + *`)];
    if (!this.detailsElements.length || !this.summaryElements.length || !this.contentElements.length) {
      return;
    }
    this.animations = Array(this.detailsElements.length).fill(null);
    this.handleSummaryClick = this.handleSummaryClick.bind(this);
    this.handleSummaryKeyDown = this.handleSummaryKeyDown.bind(this);
    this.initialize();
  }

  initialize() {
    this.detailsElements.forEach(details => {
      if (details.hasAttribute('name')) {
        details.setAttribute('data-disclosure-name', details.getAttribute('name'));
      }
      function setData() {
        details.setAttribute('data-disclosure-open', String(details.hasAttribute('open')));
      }
      new MutationObserver(setData).observe(details, {
        attributeFilter: ['open'],
      });
      setData();
    });
    this.summaryElements.forEach(summary => {
      if (!this.isFocusable(summary.parentElement)) {
        summary.setAttribute('tabindex', '-1');
        summary.style.setProperty('pointer-events', 'none');
      }
      summary.addEventListener('click', this.handleSummaryClick);
      summary.addEventListener('keydown', this.handleSummaryKeyDown);
    });
    this.contentElements.forEach(content => {
      if (!this.isFocusable(content.parentElement)) {
        content.setAttribute('hidden', '');
      }
    });
    this.rootElement.setAttribute('data-disclosure-initialized', '');
  }

  isFocusable(element) {
    return element.getAttribute('aria-disabled') !== 'true' && !element.hasAttribute('disabled');
  }

  toggle(details, isOpen) {
    const name = details.getAttribute('data-disclosure-name');
    if (name) {
      details.removeAttribute('name');
      const opened = document.querySelector(`details[data-disclosure-name="${name}"][data-disclosure-open="true"]`);
      if (isOpen && opened && opened !== details) {
        this.close(opened);
      }
    }
    window.requestAnimationFrame(() => {
      details.setAttribute('data-disclosure-open', String(isOpen));
    });
    const blockSize = window.getComputedStyle(details).getPropertyValue('block-size');
    if (isOpen) {
      details.setAttribute('open', '');
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
        blockSize: [blockSize, `${parseInt(window.getComputedStyle(details.querySelector('summary')).getPropertyValue('block-size')) + (isOpen ? parseInt(window.getComputedStyle(content).getPropertyValue('block-size')) : 0)}px`],
      },
      {
        duration: this.settings.animation.duration,
        easing: this.settings.animation.easing,
      },
    );
    animation.addEventListener('finish', () => {
      this.animations[index] = null;
      if (name) {
        details.setAttribute('name', details.getAttribute('data-disclosure-name'));
      }
      if (!isOpen) {
        details.removeAttribute('open');
      }
      ['block-size', 'overflow'].forEach(name => {
        details.style.removeProperty(name);
      });
    });
  }

  handleSummaryClick(event) {
    event.preventDefault();
    const details = event.currentTarget.parentElement;
    this.toggle(details, details.getAttribute('data-disclosure-open') !== 'true');
  }

  handleSummaryKeyDown(event) {
    const { key } = event;
    if (!['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(key)) {
      return;
    }
    event.preventDefault();
    const focusables = this.summaryElements.filter(summary => this.isFocusable(summary.parentElement));
    const currentIndex = focusables.indexOf(document.activeElement);
    const length = focusables.length;
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
    if (details.getAttribute('data-disclosure-open') === 'true') {
      return;
    }
    this.toggle(details, true);
  }

  close(details) {
    if (details.getAttribute('data-disclosure-open') === 'false') {
      return;
    }
    this.toggle(details, false);
  }
}

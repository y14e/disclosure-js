# disclosure.ts

A [disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) pattern implementation in TypeScript. Using the `<details>` and `<summary>` element.

## Usage

```ts
import Disclosure from './disclosure';

new Disclosure(root, options);
// => Disclosure
//
// root: HTMLElement
// options (optional): DisclosureOptions

```

### 🪄 Options

```ts
interface DisclosureOptions {
  animation?: {
    duration?: number; // ms (default: 300)
    easing?: string; // <easing-function> (default: 'ease')
  };
}
```

## Demo

- https://y14e.github.io/disclosure-ts/
- https://y14e.github.io/disclosure-ts/css.html

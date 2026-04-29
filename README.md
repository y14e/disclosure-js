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
    duration?: number; // ms
    easing?: string; // <easing-function>
  };
}
```

## Demo

- https://y14e.github.io/disclosure-ts/
- https://y14e.github.io/disclosure-ts/css.html

# disclosure.ts

A [disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) pattern implementation in TypeScript. Using the `<details>` and `<summary>` element.

## Usage

```ts
import Disclosure from './disclosure';

new Disclosure(root, options?);
// => Disclosure
//
// root: HTMLElement
// options?: DisclosureOptions

```

### DisclosureOptions

```ts
{
  animation?: {
    duration?: number;
    easing?: string;
  };
}
```

## Demo

- https://y14e.github.io/disclosure-ts/
- https://y14e.github.io/disclosure-ts/css.html

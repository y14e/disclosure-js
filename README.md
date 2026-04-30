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

## 🪄 Options

```ts
interface DisclosureOptions {
  animation?: {
    duration?: number; // ms (default: 300)
    easing?: string;   // <easing-function> (default: 'ease')
  };
}
```

## 📦 APIs

### `open`

```ts
disclosure.open(details);
// => void
//
// details: HTMLDetailsElement
```

### `close`

```ts
disclosure.close(details);
// => void
//
// details: HTMLDetailsElement
```

### `destroy`

Destroys the instance and cleans up all event listeners.

```ts
disclosure.destroy(force);
// => Promise<void>
//
// force (optional): If true, skips waiting for animations to finish.
```

## Demo

- https://y14e.github.io/disclosure-ts/
- https://y14e.github.io/disclosure-ts/css.html

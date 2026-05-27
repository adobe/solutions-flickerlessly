# Flickerlessly.js

Flickerlessly is a tiny JavaScript library that detects when specified elements become available in the DOM and immediately triggers a callback. It uses a lightweight `keyframes` + `animationstart` technique instead of DOM polling with `setTimeout` / `setInterval`, and without depending on `MutationObserver`.

In addition to standard DOM detection, Flickerlessly can also work with Shadow DOM and supports a small custom `>>>` syntax for direct host-to-shadow-root paths.

---

## Why Flickerlessly?

Flickerlessly was originally created to solve timing and element-detection challenges in environments where DOM content may appear asynchronously and standard polling approaches are wasteful or unreliable.

It is especially useful when:

- elements load late or are dynamically inserted
- content is hard to reach through component-based rendering
- Shadow DOM is involved
- a lightweight alternative to polling is preferred

---

## How Flickerlessly Works

Behind the scenes, Flickerlessly subscribes to DOM `animationstart` events.

When initialized, each selector is assigned a tiny CSS animation rule. As soon as a matching element appears in a watched root, that animation fires and Flickerlessly resolves the matching element and runs the associated callback.

For Shadow DOM scenarios, Flickerlessly can bind the same watcher to discovered shadow roots and validate a custom host-chain selector path when needed.

---

## Features

- Tiny and lightweight
- No DOM polling
- No `MutationObserver`
- Supports standard CSS selectors
- Supports open Shadow DOM
- Supports custom pierced host-chain syntax using `>>>`
- Supports one-time or persistent watchers
- Optional debug logging with `?Debug=1`

---

## Installation

Include `flickerlessly.js` on the page:

```html
<script src="flickerlessly.min.js"></script>
````

---

## Basic Usage

```js
Flickerlessly.onReady(
  {
    selector: '.a, .b',
    success: function (el, log) {
      log('Detected element', el);
    }
  },
  {
    selector: '.c',
    success: myCallbackFn,
    persist: true
  }
);
```

---

## Shadow DOM Usage

To enable Shadow DOM support for a watcher, set `shadow: true`.

```js
Flickerlessly.onReady({
  selector: '.price',
  shadow: true,
  success: function (el, log) {
    log('Detected inside light DOM or shadow DOM', el);
  }
});
```

This binds the watcher to the main document and to discovered shadow roots.

---

## Pierced Host-Chain Syntax (`>>>`)

Flickerlessly supports a custom `>>>` syntax for direct shadow host paths.

Example:

```js
Flickerlessly.onReady({
  selector: '#outer-host >>> #inner-host >>> .target',
  shadow: true,
  success: function (el, log) {
    log('Detected exact nested target', el);
  }
});
```

### How `>>>` works

Each `>>>` means:

> the next selector exists inside the shadow root of the previous host element

So:

```js
'#outer-host >>> #inner-host >>> .target'
```

means:

* `.target` is inside the shadow root of `#inner-host`
* `#inner-host` is inside the shadow root of `#outer-host`

### Important

`>>>` is a **custom Flickerlessly syntax**, not native CSS.

It is intended for direct host-chain matching, not arbitrary shadow-piercing CSS.

---

## API

`Flickerlessly.onReady(object1, object2, objectN)`

This is the main initializer method.

Each argument object supports the following properties:

| Name     | Type     | Required | Default | Description                                                 |
| -------- | -------- | -------- | ------- | ----------------------------------------------------------- |
| selector | String   | Yes      | None    | CSS selector or Flickerlessly `>>>` selector path to detect |
| success  | Function | Yes      | None    | Callback to execute when a match is detected                |
| persist  | Boolean  | No       | `false` | Keeps watcher active when `true`                            |
| shadow   | Boolean  | No       | `false` | Enables Shadow DOM support for the watcher                  |

---

## Option Details

### `selector`

Can be:

* a normal CSS selector
  Example:

  ```js
  '.myClass'
  '#container .cta'
  'body > p, #myElement'
  ```

* or a custom host-chain selector using `>>>`
  Example:

  ```js
  '#outer-host >>> #inner-host >>> .target'
  ```

For standard selectors, matching is root-local.

For `>>>` selectors, Flickerlessly:

1. matches the last selector part locally inside a root
2. then walks upward through shadow hosts
3. verifies that the entire selector path matches

---

### `success`

Custom callback executed after the element is detected.

It receives:

* `el` — the matched element
* `log` — the internal debug logger

Example:

```js
success: function (el, log) {
  log('Detected element', el);
}
```

---

### `persist`

Controls whether the watcher stays active after a match.

* `persist: false`
  Runs once, then removes the watcher

* `persist: true`
  Keeps the watcher active and allows future matching elements to trigger the callback

Each matching element is processed once per watcher.

---

### `shadow`

Enables Shadow DOM support for that watcher.

When `shadow: true` is used, Flickerlessly:

* binds to the main document
* discovers and binds to existing open shadow roots
* patches `attachShadow()` so newly created shadow roots can also be watched

---

## Debug Logging

Add `Debug=1` to the page URL to enable console logging:

```txt
https://example.com/page?Debug=1
```

---

## Helper Methods

### `Flickerlessly._reset()`

Removes all registered watchers, listeners, and injected styles.

Useful for testing or re-registering watchers on the same page.

```js
Flickerlessly._reset();
```

---

## Limitations

* Existing **open** shadow roots are supported
* Shadow roots created later are supported after Flickerlessly patches `attachShadow()`
* Closed shadow roots created **before** Flickerlessly loads cannot be discovered
* `>>>` is not a full shadow-piercing CSS selector engine; it is a direct host-chain syntax

---

## Example

```js
Flickerlessly.onReady(
  {
    selector: '.hero-banner',
    success: function (el, log) {
      log('Banner detected', el);
    }
  },
  {
    selector: '#product-card >>> .price',
    shadow: true,
    persist: true,
    success: function (el, log) {
      log('Shadow price detected', el);
    }
  },
  {
    selector: '#outer-host >>> #inner-host >>> .cta',
    shadow: true,
    success: function (el, log) {
      log('Nested shadow CTA detected', el);
    }
  }
);
```

---

## Contributing

Contributions are welcome. Please read the [Contributing Guide](CONTRIBUTING.md) for more information.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for more information.


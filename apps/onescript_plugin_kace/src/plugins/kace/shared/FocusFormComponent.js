import createDOMPurify from 'dompurify';

/**
 * Own DOMPurify instance, isolated from the singleton `emailHtmlSanitizeConfig.js`
 * registers global hooks on (href/data:, style, rel=noopener) — those hooks are
 * meant for email HTML, not the validation alert banner, and a future change to
 * them shouldn't silently affect this sink.
 */
const purify =
  typeof window !== 'undefined' ? createDOMPurify(window) : createDOMPurify();

const WEBFORM_ALERT_SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['ref'],
};

const focusPatchedWebforms = new WeakSet();
const alertSanitizedWebforms = new WeakSet();

/**
 * Elements a Form.io component can meaningfully receive focus on. Excludes
 * `button` (toolbars like `kace_description` render buttons before the
 * editable area) and negative-tabindex nodes.
 */
const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** React-rendered custom controls (os-select, custom-select, multiselect) that never expose `refs.input`. */
const CUSTOM_CONTROL_SELECTOR =
  '.custom-dropdown-control, .os-dropdown-control, .multi-select-input, .kace-multiselect-control';

/**
 * Number of animation frames `revealComponent` will keep re-trying to reach a
 * React-rendered control that has not painted yet (see the retry note on
 * `revealComponent`). ~8 frames ≈ 130ms at 60fps — enough for an EditGrid row
 * to reopen and its React children to mount, short enough to feel instant.
 */
const CUSTOM_CONTROL_FOCUS_RETRY_FRAMES = 8;

/**
 * Class that plays a one-off "you landed here" pulse (see `kace-error-list.css`).
 * A React-rendered control (os-select / custom-select / multiselect) shows no
 * caret or native focus ring, so after navigating from an error the user has no
 * cue where they are — the pulse gives every field type the same clear one.
 */
const NAVIGATED_CLASS = 'kace-field-navigated';

/**
 * Restarts the `NAVIGATED_CLASS` pulse on `node` and clears it once the CSS
 * animation ends (with a timeout fallback for reduced-motion / no animation).
 *
 * @param {Element | null | undefined} node
 */
const flashNavigated = (node) => {
  if (!node || !node.classList) return;
  node.classList.remove(NAVIGATED_CLASS);
  // Force a reflow so re-adding the class restarts the animation.
  void (/** @type {HTMLElement} */ (node).offsetWidth);
  node.classList.add(NAVIGATED_CLASS);

  let done = false;
  const clear = () => {
    if (done) return;
    done = true;
    node.classList.remove(NAVIGATED_CLASS);
    node.removeEventListener('animationend', clear);
  };
  node.addEventListener('animationend', clear);
  setTimeout(clear, 2500);
};

/**
 * Focuses the first standard-focusable node inside `el`, or failing that the
 * first custom React control (os-select / custom-select / multiselect).
 *
 * @param {Element} el
 * @returns {Element | null} the node that was focused, or null if none
 */
const focusInnerControl = (el) => {
  const standardFocusable = el.querySelector(FOCUSABLE_SELECTOR);
  const focusable =
    standardFocusable || el.querySelector(CUSTOM_CONTROL_SELECTOR);

  if (!focusable || typeof focusable.focus !== 'function') return null;

  // Only custom controls (os-select and the like) need a forced tabIndex — a
  // standard-focusable match is already in the tab order by construction
  // (FOCUSABLE_SELECTOR excludes negative-tabindex nodes), and writing
  // tabindex="-1" on it would pull it back out.
  if (!standardFocusable && focusable.tabIndex < 0) {
    focusable.tabIndex = -1;
  }
  focusable.focus();
  return focusable;
};

/**
 * Re-reads `comp.element` on a later frame and retries reaching its inner
 * control. Used only for React-rendered controls that were not in the DOM on
 * the click tick (see the retry note on `revealComponent`).
 *
 * @param {any} comp - Form.io component instance
 * @param {number} framesLeft
 */
const retryRevealInnerControl = (comp, framesLeft) => {
  if (framesLeft <= 0 || typeof requestAnimationFrame !== 'function') {
    // Gave up locating the inner control — still pulse the wrapper so the
    // click is acknowledged instead of feeling inert.
    flashNavigated(comp?.element);
    return;
  }
  requestAnimationFrame(() => {
    const el = comp?.element;
    if (!el) {
      retryRevealInnerControl(comp, framesLeft - 1);
      return;
    }
    const focused = focusInnerControl(el);
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (focused) {
      flashNavigated(focused);
    } else {
      retryRevealInnerControl(comp, framesLeft - 1);
    }
  });
};

/**
 * Scrolls a resolved Form.io component into view and focuses its control.
 *
 * For a native input component the caller's `component.focus()` has already
 * focused `refs.input`; this just brings it to the centre of the viewport
 * (Form.io's own `focus()` does not scroll in this renderer version). For a
 * React-rendered control (os-select / custom-select / multiselect), which never
 * registers `refs.input`, this focuses the inner `.os-dropdown-control`-style
 * node instead.
 *
 * Retry note: a React-rendered control mounts its focusable node through an
 * async React root, so on the click tick it may not be in the DOM yet — and
 * inside an EditGrid the row may still be opening. When the synchronous pass
 * finds nothing focusable, `retryRevealInnerControl` reaches it on a later
 * frame.
 *
 * @param {any} comp - Form.io component instance
 */
export const revealComponent = (comp) => {
  if (!comp) return;

  const el = comp.element;
  const hasNativeInputRef = !!comp.refs?.input?.length;
  let focused = null;

  if (!hasNativeInputRef && el) {
    focused = focusInnerControl(el);
    if (!focused && typeof el.focus === 'function') {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus();
    }
  }

  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const innerControlFocused = hasNativeInputRef || !!focused;

  if (!hasNativeInputRef && !innerControlFocused) {
    // Control not painted yet — the retry will pulse it once it appears.
    retryRevealInnerControl(comp, CUSTOM_CONTROL_FOCUS_RETRY_FRAMES);
  } else {
    // Pulse the field so the user can see where the navigation landed — the
    // caret makes this obvious for a text input, but a custom select shows
    // nothing on its own. Highlight the control we focused when we have it,
    // otherwise the component wrapper.
    flashNavigated(focused || el);
  }
};

/**
 * Scrolls to and focuses a Form.io component by key, replacing the native
 * `Webform.focusOnComponent`, which only works when the component registers
 * `refs.input` — custom React-rendered components (e.g. `os-select`,
 * `custom-select`) never do, so their native `component.focus()` no-ops.
 *
 * `comp.focus()` is called unconditionally (not just when `refs.input`
 * exists) because formiojs's base `Component.focus()` always calls
 * `this.parent.beforeFocus(this)` first — that's the chain an ancestor Tabs
 * component uses to switch to whichever tab holds the target field, and the
 * chain an ancestor EditGrid uses to reopen the row holding the field. Tabs
 * keeps every panel mounted in the DOM and only toggles `display:none` on
 * inactive ones, so without triggering that switch, scrolling/focusing a
 * field on another tab is a no-op on a hidden element. The `revealComponent`
 * scroll runs after, once that switch (synchronous) has made the field
 * visible again.
 *
 * @param {any} webform - Form.io Webform instance
 * @param {string} key
 */
export const focusFormComponent = (webform, key) => {
  if (!webform || !key || typeof webform.getComponent !== 'function') return;
  const comp = webform.getComponent(key);
  if (!comp) return;

  if (typeof comp.focus === 'function') {
    try {
      comp.focus();
    } catch {
      // ignore, fall through to manual focus
    }
  }

  revealComponent(comp);
};

/**
 * Replaces `webform.focusOnComponent` so the native `errorsList` links (and
 * any other caller) navigate through `focusFormComponent` instead of Form.io's
 * built-in implementation, which relies on `refs.input`. Idempotent.
 *
 * @param {any} webform
 */
export const attachFocusFormComponent = (webform) => {
  if (!webform || focusPatchedWebforms.has(webform)) return;
  webform.focusOnComponent = (key) => focusFormComponent(webform, key);
  focusPatchedWebforms.add(webform);
};

/**
 * `Webform.showErrors`/`setAlert` interpolate `err.message` and `err.keyOrPath`
 * into the alert markup and call `unescapeHTML` on the result, so pre-escaping
 * upstream values does not stop injected markup from executing. Wrapping
 * `setAlert` (the final sink) and sanitizing there is what actually stops it.
 * `ref` is allowed through so the native error-list navigation keeps working.
 * Idempotent.
 *
 * @param {any} webform
 */
export const patchAlertSanitizer = (webform) => {
  if (
    !webform ||
    typeof webform.setAlert !== 'function' ||
    alertSanitizedWebforms.has(webform)
  )
    return;
  const original = webform.setAlert.bind(webform);
  webform.setAlert = (type, message, ...rest) => {
    const safe =
      typeof message === 'string'
        ? purify.sanitize(message, WEBFORM_ALERT_SANITIZE_CONFIG)
        : message;
    return original(type, safe, ...rest);
  };
  alertSanitizedWebforms.add(webform);
};

/**
 * Form.io's `errorsList` template always renders each item with
 * `role="link" tabindex="0"`, regardless of whether `data-component-key`
 * resolves to a mounted component (see `Webform.showErrors` -> `createListItem`
 * in formiojs, which only sets `keyOrPath` from `err.component`/`err.fromServer`
 * — a plain `{ message }` extra error, like the ones this module passes through
 * for unmatched Joi errors, gets an empty key). Demote those specific items
 * after render so they don't look clickable when `focusOnComponent` is a no-op
 * for them.
 *
 * @param {any} webform
 */
const demoteUnresolvableErrorLinks = (webform) => {
  const container = webform?.alert;
  if (!container || typeof container.querySelectorAll !== 'function') return;
  container.querySelectorAll('[role="link"]').forEach((node) => {
    const key = node.getAttribute('data-component-key');
    const comp =
      key && typeof webform.getComponent === 'function'
        ? webform.getComponent(key)
        : null;
    if (comp) return;
    node.removeAttribute('role');
    node.removeAttribute('tabindex');
    node.style.cursor = 'default';
  });
};

/**
 * Patches focus navigation + alert sanitization on `webform`, then shows the
 * native Form.io error list (optionally merged with `extraErrors` for Joi
 * errors that don't map to a mounted component) and scrolls to it.
 *
 * @param {any} webform
 * @param {Array<{ message: string }>|null} [extraErrors]
 */
export const showWebformErrors = (webform, extraErrors = null) => {
  if (!webform || typeof webform.showErrors !== 'function') return;
  attachFocusFormComponent(webform);
  patchAlertSanitizer(webform);
  webform.showErrors(extraErrors, true);
  demoteUnresolvableErrorLinks(webform);
  if (typeof webform.scrollIntoView === 'function' && webform.alert) {
    webform.scrollIntoView(webform.alert);
  }
};

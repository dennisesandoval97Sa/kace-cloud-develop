import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  focusFormComponent,
  attachFocusFormComponent,
  patchAlertSanitizer,
  showWebformErrors,
  revealComponent,
} from './FocusFormComponent.js';

const makeElement = ({
  hasStandardFocusable = true,
  hasCustomControl = false,
} = {}) => {
  const el = document.createElement('div');
  if (hasStandardFocusable) {
    const input = document.createElement('input');
    el.appendChild(input);
  }
  if (hasCustomControl) {
    const control = document.createElement('div');
    control.className = 'os-dropdown-control';
    el.appendChild(control);
  }
  el.scrollIntoView = vi.fn();
  return el;
};

describe('focusFormComponent', () => {
  it('is a no-op when webform, key or getComponent is missing', () => {
    expect(() => focusFormComponent(null, 'foo')).not.toThrow();
    expect(() =>
      focusFormComponent({ getComponent: vi.fn() }, null)
    ).not.toThrow();
    expect(() => focusFormComponent({}, 'foo')).not.toThrow();
  });

  it('is a no-op when the component does not exist', () => {
    const webform = { getComponent: vi.fn(() => null) };
    expect(() => focusFormComponent(webform, 'missing')).not.toThrow();
  });

  it('calls native focus() then scrolls, in that order, when refs.input is present', () => {
    const el = makeElement();
    const order = [];
    el.scrollIntoView = vi.fn(() => order.push('scroll'));
    const focus = vi.fn(() => order.push('focus'));
    const comp = { element: el, refs: { input: [{}] }, focus };
    const webform = { getComponent: vi.fn(() => comp) };

    focusFormComponent(webform, 'field1');

    expect(focus).toHaveBeenCalledTimes(1);
    expect(el.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    expect(order).toEqual(['focus', 'scroll']);
  });

  it('does not propagate when comp.focus() throws', () => {
    const el = makeElement();
    const comp = {
      element: el,
      refs: { input: [{}] },
      focus: () => {
        throw new Error('boom');
      },
    };
    const webform = { getComponent: vi.fn(() => comp) };

    expect(() => focusFormComponent(webform, 'field1')).not.toThrow();
  });

  it('calls comp.focus() even without a native input ref, so an ancestor Tabs component can switch to the tab holding the field', () => {
    // formiojs's base Component.focus() always calls `parent.beforeFocus(this)`
    // first, which is how a Tabs ancestor activates the panel containing the
    // target field. React-rendered components (os-select, custom-select) never
    // register `refs.input`, but must still get this call or a link to a field
    // on another tab silently does nothing (the panel stays `display:none`).
    const el = makeElement();
    const focus = vi.fn();
    const comp = { element: el, refs: {}, focus };
    const webform = { getComponent: vi.fn(() => comp) };

    focusFormComponent(webform, 'field1');

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('falls back to querySelector when there is no native input ref', () => {
    const el = makeElement();
    const input = el.querySelector('input');
    const focusSpy = vi.spyOn(input, 'focus');
    const comp = { element: el, refs: {} };
    const webform = { getComponent: vi.fn(() => comp) };

    focusFormComponent(webform, 'field1');

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to the custom control selector for os-select-like components', () => {
    const el = makeElement({
      hasStandardFocusable: false,
      hasCustomControl: true,
    });
    const control = el.querySelector('.os-dropdown-control');
    control.focus = vi.fn();
    const comp = { element: el, refs: {} };
    const webform = { getComponent: vi.fn(() => comp) };

    focusFormComponent(webform, 'field1');

    expect(control.focus).toHaveBeenCalledTimes(1);
  });

  it('does not force a negative tabindex on a standard focusable element (e.g. a contenteditable editor)', () => {
    const el = makeElement({ hasStandardFocusable: false });
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.focus = vi.fn();
    el.appendChild(editable);
    const comp = { element: el, refs: {} };
    const webform = { getComponent: vi.fn(() => comp) };

    focusFormComponent(webform, 'field1');

    expect(editable.focus).toHaveBeenCalledTimes(1);
    expect(editable.hasAttribute('tabindex')).toBe(false);
  });

  it('focuses the element itself when nothing focusable is found', () => {
    const el = makeElement({ hasStandardFocusable: false });
    el.focus = vi.fn();
    const comp = { element: el, refs: {} };
    const webform = { getComponent: vi.fn(() => comp) };

    focusFormComponent(webform, 'field1');

    expect(el.focus).toHaveBeenCalledTimes(1);
    expect(el.getAttribute('tabindex')).toBe('-1');
  });

  it('retries on a later frame for a React control that has not mounted its focusable node yet', async () => {
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        setTimeout(cb, 0);
        return 1;
      });

    // os-select wrapper: no standard focusable and no `.os-dropdown-control`
    // yet (async React root has not painted).
    const el = makeElement({ hasStandardFocusable: false });
    const comp = { element: el, refs: {}, focus: vi.fn() };
    const webform = { getComponent: vi.fn(() => comp) };

    focusFormComponent(webform, 'rva_tipo_cuenta_bancaria');

    // React mounts the control after the click tick.
    const control = document.createElement('div');
    control.className = 'os-dropdown-control';
    control.focus = vi.fn();
    el.appendChild(control);

    await new Promise((r) => setTimeout(r, 5));

    expect(control.focus).toHaveBeenCalledTimes(1);
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(control.classList.contains('kace-field-navigated')).toBe(true);

    rafSpy.mockRestore();
  });

  it('scrolls after the tab switch, so a field on a just-activated tab is scrolled into view once visible', () => {
    // Simulates a TabsComponent: `comp.focus()` synchronously flips the
    // ancestor tab panel from `display:none` to `display:block` (via
    // `beforeFocus` -> `setTab`). scrollIntoView must run after that, not
    // before, or it operates on a still-hidden element.
    const el = makeElement({ hasStandardFocusable: false });
    el.style.display = 'none';
    const focus = vi.fn(() => {
      el.style.display = 'block';
    });
    let displayAtScrollTime = null;
    el.scrollIntoView = vi.fn(() => {
      displayAtScrollTime = el.style.display;
    });
    const comp = { element: el, refs: {}, focus };
    const webform = { getComponent: vi.fn(() => comp) };

    focusFormComponent(webform, 'field1');

    expect(displayAtScrollTime).toBe('block');
  });
});

describe('revealComponent', () => {
  it('scrolls a native-input component into view (Form.io focus() does not scroll in this renderer)', () => {
    const el = makeElement();
    const comp = { element: el, refs: { input: [{}] } };

    revealComponent(comp);

    expect(el.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('focuses the inner custom control for an os-select-like component and scrolls', () => {
    const el = makeElement({
      hasStandardFocusable: false,
      hasCustomControl: true,
    });
    const control = el.querySelector('.os-dropdown-control');
    control.focus = vi.fn();
    const comp = { element: el, refs: {} };

    revealComponent(comp);

    expect(control.focus).toHaveBeenCalledTimes(1);
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it('pulses the inner control of a custom select so the user sees where navigation landed', () => {
    const el = makeElement({
      hasStandardFocusable: false,
      hasCustomControl: true,
    });
    const control = el.querySelector('.os-dropdown-control');
    control.focus = vi.fn();

    revealComponent({ element: el, refs: {} });

    expect(control.classList.contains('kace-field-navigated')).toBe(true);
    expect(el.classList.contains('kace-field-navigated')).toBe(false);
  });

  it('falls back to .kace-multiselect-control for a MultiSelectBase trigger', () => {
    const el = makeElement({ hasStandardFocusable: false });
    const control = document.createElement('div');
    control.className = 'kace-multiselect-control';
    control.focus = vi.fn();
    el.appendChild(control);

    revealComponent({ element: el, refs: {} });

    expect(control.focus).toHaveBeenCalledTimes(1);
    expect(control.classList.contains('kace-field-navigated')).toBe(true);
  });

  it('pulses the component wrapper for a native input', () => {
    const el = makeElement();
    revealComponent({ element: el, refs: { input: [{}] } });
    expect(el.classList.contains('kace-field-navigated')).toBe(true);
  });

  it('pulses the wrapper when the inner control never appears (retry exhausted)', () => {
    const pending = [];
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        pending.push(cb);
        return pending.length;
      });

    try {
      const el = makeElement({ hasStandardFocusable: false });
      el.focus = vi.fn();

      revealComponent({ element: el, refs: {} });
      expect(el.classList.contains('kace-field-navigated')).toBe(false);

      // Drain the nested requestAnimationFrame chain deterministically, no
      // real clock: each frame may enqueue the next one.
      while (pending.length > 0) {
        const cb = pending.shift();
        cb(0);
      }

      expect(el.classList.contains('kace-field-navigated')).toBe(true);
    } finally {
      rafSpy.mockRestore();
    }
  });

  it('is a no-op without a component', () => {
    expect(() => revealComponent(null)).not.toThrow();
    expect(() => revealComponent(undefined)).not.toThrow();
  });
});

describe('attachFocusFormComponent', () => {
  it('is a no-op without a webform', () => {
    expect(() => attachFocusFormComponent(null)).not.toThrow();
  });

  it('assigns focusOnComponent and does not re-wrap on a second call', () => {
    const webform = {};
    attachFocusFormComponent(webform);
    const first = webform.focusOnComponent;
    expect(typeof first).toBe('function');

    attachFocusFormComponent(webform);
    expect(webform.focusOnComponent).toBe(first);
  });
});

describe('patchAlertSanitizer', () => {
  let webform;

  beforeEach(() => {
    webform = { setAlert: vi.fn() };
  });

  it('is a no-op without a webform.setAlert function', () => {
    expect(() => patchAlertSanitizer(null)).not.toThrow();
    expect(() => patchAlertSanitizer({})).not.toThrow();
  });

  it('sanitizes the message argument passed to the original setAlert', () => {
    const original = vi.fn();
    webform.setAlert = original;
    patchAlertSanitizer(webform);

    webform.setAlert(
      'danger',
      '<img src=x onerror=alert(1)><script>alert(2)</script>Hola'
    );

    expect(original).toHaveBeenCalledTimes(1);
    const [, sanitized] = original.mock.calls[0];
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).toContain('Hola');
  });

  it('preserves the ref attribute used by native error-list navigation', () => {
    const original = vi.fn();
    webform.setAlert = original;
    patchAlertSanitizer(webform);

    webform.setAlert(
      'danger',
      '<a href="#" ref="errorRef" data-component-key="field1">Ver campo</a>'
    );

    const [, sanitized] = original.mock.calls[0];
    expect(sanitized).toContain('ref="errorRef"');
  });

  it('passes non-string messages through untouched', () => {
    const original = vi.fn();
    webform.setAlert = original;
    patchAlertSanitizer(webform);

    webform.setAlert('danger', false);

    expect(original).toHaveBeenCalledWith('danger', false);
  });

  it('does not wrap setAlert twice', () => {
    patchAlertSanitizer(webform);
    const wrapped = webform.setAlert;
    patchAlertSanitizer(webform);
    expect(webform.setAlert).toBe(wrapped);
  });
});

describe('showWebformErrors', () => {
  it('is a no-op when showErrors is missing', () => {
    expect(() => showWebformErrors(null)).not.toThrow();
    expect(() => showWebformErrors({})).not.toThrow();
  });

  it('attaches focus navigation, sanitizes dirty markup reaching setAlert, shows errors and scrolls to the alert', () => {
    const webform = {
      setAlert: vi.fn(function (type, message) {
        this.alert = message;
      }),
      showErrors: vi.fn(function () {
        this.setAlert('danger', '<img src=x onerror=alert(1)>Hola');
      }),
      scrollIntoView: vi.fn(),
      alert: null,
      getComponent: vi.fn(() => null),
    };

    showWebformErrors(webform, [{ message: 'extra' }]);

    expect(typeof webform.focusOnComponent).toBe('function');
    expect(webform.showErrors).toHaveBeenCalledWith(
      [{ message: 'extra' }],
      true
    );
    expect(webform.alert).not.toContain('onerror');
    expect(webform.alert).toContain('Hola');
    expect(webform.scrollIntoView).toHaveBeenCalledWith(webform.alert);
  });

  it('does not scroll when no alert was painted', () => {
    const webform = {
      showErrors: vi.fn(),
      scrollIntoView: vi.fn(),
      alert: null,
    };

    showWebformErrors(webform, null);

    expect(webform.scrollIntoView).not.toHaveBeenCalled();
  });

  it('demotes error-list items that do not resolve to a mounted component, leaving resolvable ones untouched', () => {
    const alertContainer = document.createElement('div');
    alertContainer.innerHTML =
      '<span role="link" tabindex="0" data-component-key="field1">Campo con componente</span>' +
      '<span role="link" tabindex="0" data-component-key="">Error sin componente</span>';
    const webform = {
      showErrors: vi.fn(function () {
        this.alert = alertContainer;
      }),
      getComponent: vi.fn((key) => (key === 'field1' ? {} : null)),
      alert: null,
    };

    showWebformErrors(webform, null);

    const [resolved, unresolved] = alertContainer.querySelectorAll('span');
    expect(resolved.getAttribute('role')).toBe('link');
    expect(resolved.hasAttribute('tabindex')).toBe(true);
    expect(unresolved.getAttribute('role')).toBeNull();
    expect(unresolved.hasAttribute('tabindex')).toBe(false);
  });
});

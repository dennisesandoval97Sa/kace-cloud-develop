import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@formio/react', () => {
  const formioMessages = {
    required: '{{field}} es obligatorio',
    error: 'Por favor corrige los siguientes errores antes de enviar.',
  };
  class FakeFormioComponent {
    constructor(component, options, data) {
      this.component = component;
      this.options = options || {};
      this.data = data || {};
      this.dataValue = this.data[component.key];
      this.error = null;
      this.pristine = true;
      this.builderMode = false;
      this.visible = true;
    }
    get visible() {
      return this._visible !== false;
    }
    set visible(v) {
      this._visible = v;
    }
    t(template, params) {
      if (typeof template !== 'string') return String(template);
      const translated = formioMessages[template] || template;
      if (!params) return translated;
      return translated.replace(/\{\{(\w+)\}\}/g, (_, k) =>
        params[k] != null ? String(params[k]) : `{{${k}}}`
      );
    }
    errorMessage(key) {
      return key;
    }
    checkValidity() {
      return true;
    }
    // Mirrors formiojs 4.21 Component.setCustomValidity: builds `this.error` for
    // a message, and clears it for '' only when the `external` flag matches
    // (that guard is exactly what the Kace override must not break).
    setCustomValidity(messages, dirty, external) {
      let normalized = messages;
      if (typeof normalized === 'string' && normalized) {
        normalized = { level: 'error', message: normalized };
      }
      normalized = !normalized
        ? []
        : Array.isArray(normalized)
          ? normalized
          : [normalized];
      if (normalized.length) {
        this.error = {
          component: this.component,
          message: normalized[0].message,
          messages: normalized,
          external: !!external,
        };
      } else if (!this.error || this.error.external === !!external) {
        this.error = null;
      }
    }
  }
  return {
    Components: { components: { textfield: FakeFormioComponent } },
    Utils: { evaluate: vi.fn() },
  };
});

vi.mock('#plugins/kace/shared/evaluateKace.js', () => ({
  evaluateKace: vi.fn(),
}));

vi.mock('#plugins/kace/shared/FindSchemaForKey.js', () => ({
  findSchemaForKey: vi.fn(() => null),
}));

vi.mock('#plugins/kace/shared/customOnChange.editForm.json', () => ({
  default: { components: [] },
}));

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: vi.fn(() => ({
    getService: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
  })),
}));

vi.mock('#plugins/kace/shared/kace-events.constants.js', () => ({
  SCHEMA_KEY_CUSTOM_ON_CHANGE: 'customOnChange',
}));

vi.mock('../services/storeService.js', () => ({
  storeService: { get: vi.fn(() => null), set: vi.fn() },
}));

import KaceBaseComponent from './KaceBaseComponent.js';

const makeComponent = (kaceValidation) => {
  const KaceClass = KaceBaseComponent.create({
    componentType: 'kace_text_field',
    formioBaseComponent: 'textfield',
    builderInfo: { title: 't', icon: 'fa fa-i' },
  });
  const componentConfig = {
    type: 'kace_text_field',
    key: 'qty',
    label: 'Cantidad',
    kaceValidation,
  };
  const inst = new KaceClass(componentConfig, {}, {});
  return inst;
};

describe('KaceBaseComponent.checkValidity — regression for i18n guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts an empty value for an OPTIONAL number field (regression: number.base guard must work with translated messages)', () => {
    const comp = makeComponent({ type: 'number', required: false });
    comp.dataValue = '';
    expect(comp.checkValidity(null, true)).toBe(true);
    expect(comp.error).toBeNull();
  });

  it('accepts a valid number for an OPTIONAL number field', () => {
    const comp = makeComponent({ type: 'number', required: false });
    comp.dataValue = 7;
    expect(comp.checkValidity(null, true)).toBe(true);
  });

  it('rejects an empty value for a REQUIRED number field with a translated message that includes the field label', () => {
    const comp = makeComponent({ type: 'number', required: true });
    comp.dataValue = '';
    expect(comp.checkValidity(null, true)).toBe(false);
    expect(comp.error).toBeDefined();
    expect(comp.error.message).toContain('obligatorio');
  });

  it('rejects a non-numeric string for an OPTIONAL number field', () => {
    const comp = makeComponent({ type: 'number', required: false });
    comp.dataValue = 'not-a-number';
    expect(comp.checkValidity(null, true)).toBe(false);
    expect(comp.error).toBeDefined();
  });

  it('uses the component label in Joi min-length errors instead of "value"', () => {
    const comp = makeComponent({ type: 'string', required: false, min: 5 });
    comp.dataValue = '1234';
    expect(comp.checkValidity(null, true)).toBe(false);
    expect(comp.error.message).toContain('Cantidad');
    expect(comp.error.message).not.toContain('"value"');
    expect(comp.error.message).toContain('debe tener al menos 5 caracteres');
  });

  it('carries the component path on the error so the renderer can wire the error-list item to the field', () => {
    const comp = makeComponent({ type: 'number', required: true });
    comp.path = 'puntos_de_venta[0].qty';
    comp.dataValue = '';
    expect(comp.checkValidity(null, true)).toBe(false);
    expect(comp.error.path).toBe('puntos_de_venta[0].qty');
    expect(comp.error.messages[0].path).toBe('puntos_de_venta[0].qty');
    expect(comp.error.messages[0].context.hasLabel).toBe(true);
    expect(comp.error.messages[0].message).toBe(comp.error.message);
  });

  it('falls back to the component key for the error path when the instance has no path', () => {
    const comp = makeComponent({ type: 'number', required: true });
    comp.dataValue = '';
    comp.checkValidity(null, true);
    expect(comp.error.path).toBe('qty');
  });

  it('keeps the `external` flag so a later setCustomValidity("") clears the error (no phantom banner)', () => {
    const comp = makeComponent({ type: 'number', required: true });
    comp.dataValue = '';
    expect(comp.checkValidity(null, true)).toBe(false);
    expect(comp.error).not.toBeNull();
    expect(comp.error.external).toBe(false);

    // Form.io does this for a nested form that turns valid / on redraw.
    comp.setCustomValidity('');
    expect(comp.error).toBeNull();
  });
});

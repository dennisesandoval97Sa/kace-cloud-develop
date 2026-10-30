import { describe, expect, it, vi } from 'vitest';
import { createFormComponentRedrawFns } from './createFormComponentRedrawFns.js';

describe('createFormComponentRedrawFns', () => {
  it('redrawComponent resolves by key and emits redraw', () => {
    const emit = vi.fn();
    const renderReactComponent = vi.fn();
    const root = {
      getComponent: (key) =>
        key === 'mySelect' ? { emit, renderReactComponent } : null,
      everyComponent: vi.fn(),
    };

    const { redrawComponent } = createFormComponentRedrawFns(root);
    expect(redrawComponent('mySelect')).toBe(true);
    expect(renderReactComponent).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('redraw', { key: 'mySelect' });
  });

  it('redrawComponent returns false when component is missing', () => {
    const root = {
      getComponent: () => null,
      everyComponent: () => {},
    };
    const { redrawComponent } = createFormComponentRedrawFns(root);
    expect(redrawComponent('missing')).toBe(false);
  });

  it('redrawAll emits on root and globalRoot', () => {
    const rootEmit = vi.fn();
    const globalEmit = vi.fn();
    const root = { emit: rootEmit, globalRoot: { emit: globalEmit } };
    const { redrawAll } = createFormComponentRedrawFns(root);
    expect(redrawAll()).toBe(true);
    expect(rootEmit).toHaveBeenCalledWith('redraw');
    expect(globalEmit).toHaveBeenCalledWith('redraw');
  });

  it('setFieldRequired updates validate and kaceValidation', () => {
    const redraw = vi.fn();
    const comp = {
      component: {
        key: 'email',
        validate: { required: false },
        kaceValidation: { required: false, type: 'string' },
      },
      redraw,
    };
    const root = { getComponent: () => comp, everyComponent: vi.fn() };
    const validationSchemaRef = {
      current: { email: { required: false, type: 'string' } },
    };
    const { setFieldRequired } = createFormComponentRedrawFns(root, {
      searchNestedFormOnly: true,
      validationSchemaRef,
    });
    expect(setFieldRequired('email', true)).toBe(true);
    expect(comp.component.validate.required).toBe(true);
    expect(comp.component.kaceValidation.required).toBe(true);
    expect(validationSchemaRef.current.email.required).toBe(true);
    expect(redraw).toHaveBeenCalled();
  });

  it('setFieldHidden sets component.hidden', () => {
    const redraw = vi.fn();
    const comp = {
      component: { key: 'detalle', hidden: false },
      redraw,
    };
    const root = { getComponent: () => comp, everyComponent: vi.fn() };
    const { setFieldHidden } = createFormComponentRedrawFns(root, {
      searchNestedFormOnly: true,
    });
    expect(setFieldHidden('detalle', true)).toBe(true);
    expect(comp.component.hidden).toBe(true);
    expect(comp.component.customConditional).toBe('show = false;');
    expect(redraw).toHaveBeenCalled();
  });

  it('setFieldHidden overrides customConditional and restores on show', () => {
    const redraw = vi.fn();
    const comp = {
      component: {
        key: 'detalle',
        hidden: false,
        customConditional: "show = data.activo === 'si';",
      },
      redraw,
      checkConditions: vi.fn(),
    };
    const root = { getComponent: () => comp, everyComponent: vi.fn() };
    const { setFieldHidden } = createFormComponentRedrawFns(root, {
      searchNestedFormOnly: true,
    });
    expect(setFieldHidden('detalle', true)).toBe(true);
    expect(comp.component.customConditional).toBe('show = false;');
    expect(setFieldHidden('detalle', false)).toBe(true);
    expect(comp.component.customConditional).toBe(
      "show = data.activo === 'si';"
    );
    expect(comp.checkConditions).toHaveBeenCalled();
  });

  it('setFieldProperties applies required, hidden and disabled', () => {
    const redraw = vi.fn();
    const setDisabled = vi.fn();
    const comp = {
      component: {
        key: 'campo',
        hidden: false,
        disabled: false,
        validate: { required: false },
      },
      disabled: false,
      redraw,
      setDisabled,
    };
    const root = { getComponent: () => comp, everyComponent: vi.fn() };
    const validationSchemaRef = {
      current: {
        campo: { required: false, type: 'string', ui: { read_only: false } },
      },
    };
    const { setFieldProperties } = createFormComponentRedrawFns(root, {
      searchNestedFormOnly: true,
      validationSchemaRef,
    });
    expect(
      setFieldProperties('campo', {
        required: false,
        hidden: true,
        disabled: true,
      })
    ).toBe(true);
    expect(comp.component.hidden).toBe(true);
    expect(comp.component.disabled).toBe(true);
    expect(setDisabled).toHaveBeenCalledWith(true);
  });

  it('setFieldDisabled sets component.disabled and ui.read_only', () => {
    const redraw = vi.fn();
    const comp = {
      component: { key: 'codigo', disabled: false },
      disabled: false,
      redraw,
    };
    const root = { getComponent: () => comp, everyComponent: vi.fn() };
    const validationSchemaRef = {
      current: {
        codigo: { type: 'string', ui: { read_only: false } },
      },
    };
    const { setFieldDisabled } = createFormComponentRedrawFns(root, {
      searchNestedFormOnly: true,
      validationSchemaRef,
    });
    expect(setFieldDisabled('codigo', true)).toBe(true);
    expect(comp.component.disabled).toBe(true);
    expect(comp.disabled).toBe(true);
    expect(validationSchemaRef.current.codigo.ui.read_only).toBe(true);
    expect(redraw).toHaveBeenCalled();
  });
});

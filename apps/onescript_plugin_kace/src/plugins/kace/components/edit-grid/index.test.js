import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The hotfix path: `edit-grid/index.js` patches `EditGrid.prototype.addRowModal`
 * (shared prototype, so the base non-Kace EditGrid is covered too) to wrap the
 * freshly created `alert.focusOnComponent`, so a click on the row-modal error
 * list resolves the field via `root.getComponent` and calls `revealComponent`.
 */

const revealComponent = vi.fn();
vi.mock('#plugins/kace/shared/FocusFormComponent.js', () => ({
  revealComponent,
}));
vi.mock('#plugins/kace/shared/styles/kace-error-list.css', () => ({}));
vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('@formio/react', () => {
  class FakeEditGrid {
    constructor(component = {}, options = {}, data = {}) {
      this.component = component;
      this.options = options;
      this.data = data;
      this.editRows = [];
    }

    static schema(obj) {
      return { ...obj };
    }

    addRow() {}
    editRow() {}
    saveRow() {}
    cancelRow() {}

    // Mirrors formiojs: creates `this.alert` synchronously before returning.
    addRowModal(rowIndex) {
      this._addRowModalRan = rowIndex;
      const rawFocus = vi.fn();
      this._rawAlertFocus = rawFocus;
      this.alert = { focusOnComponent: rawFocus };
      return 'base-add-row-modal';
    }
  }

  return {
    Components: {
      components: { editgrid: FakeEditGrid },
      create: (c, o, d) => new FakeEditGrid(c, o, d),
      baseEditForm: () => ({}),
    },
  };
});

const { Components } = await import('@formio/react');
const FakeEditGrid = Components.components.editgrid;
const baseAddRowModal = FakeEditGrid.prototype.addRowModal;

// Importing the module runs the module-level prototype patch against the fake.
await import('./index.js');

const makeGrid = ({ parentPath = '', getComponent = vi.fn() } = {}) => {
  const grid = new FakeEditGrid();
  grid._parentPath = parentPath;
  grid.root = { getComponent };
  return grid;
};

beforeEach(() => {
  revealComponent.mockClear();
});

describe('EditGrid row-modal error-list navigation patch', () => {
  it('wraps addRowModal on the shared prototype exactly once', () => {
    expect(FakeEditGrid.prototype.__kaceRowModalAlertNavPatched).toBe(true);
    expect(FakeEditGrid.prototype.addRowModal).not.toBe(baseAddRowModal);
  });

  it('runs the original addRowModal and marks the fresh alert as patched', () => {
    const grid = makeGrid();
    const result = grid.addRowModal(2);

    expect(result).toBe('base-add-row-modal');
    expect(grid._addRowModalRan).toBe(2);
    expect(grid.alert.__kaceRevealPatched).toBe(true);
    expect(typeof grid.alert.focusOnComponent).toBe('function');
  });

  it('on click: trims _parentPath, resolves via root.getComponent(path, null, keyOrPath) and reveals the field', () => {
    const field = { element: document.createElement('div'), refs: {} };
    const getComponent = vi.fn(() => field);
    const grid = makeGrid({ parentPath: 'puntos_de_venta', getComponent });
    grid.addRowModal(0);

    const keyOrPath = 'puntos_de_venta[0].rva_tipo_cuenta_bancaria';
    grid.alert.focusOnComponent(keyOrPath);

    expect(getComponent).toHaveBeenCalledWith(
      '[0].rva_tipo_cuenta_bancaria',
      null,
      keyOrPath
    );
    expect(revealComponent).toHaveBeenCalledWith(field);
  });

  it('passes keyOrPath through unchanged when the EditGrid has no _parentPath', () => {
    const field = { element: document.createElement('div'), refs: {} };
    const getComponent = vi.fn(() => field);
    const grid = makeGrid({ parentPath: '', getComponent });
    grid.addRowModal(0);

    grid.alert.focusOnComponent('telefono_contacto');

    expect(getComponent).toHaveBeenCalledWith(
      'telefono_contacto',
      null,
      'telefono_contacto'
    );
  });

  it('still calls the original Alert.focusOnComponent so beforeFocus / row reopen keeps working', () => {
    const grid = makeGrid({ getComponent: vi.fn(() => null) });
    grid.addRowModal(0);

    grid.alert.focusOnComponent('some[0].key');

    expect(grid._rawAlertFocus).toHaveBeenCalledWith('some[0].key');
  });

  it('does not reveal when the field cannot be resolved (and does not throw)', () => {
    const grid = makeGrid({ getComponent: vi.fn(() => null) });
    grid.addRowModal(0);

    expect(() => grid.alert.focusOnComponent('missing.field')).not.toThrow();
    expect(revealComponent).not.toHaveBeenCalled();
  });

  it('is a no-op on click without a key (native focusOnComponent(undefined))', () => {
    const getComponent = vi.fn();
    const grid = makeGrid({ getComponent });
    grid.addRowModal(0);

    grid.alert.focusOnComponent(undefined);

    expect(getComponent).not.toHaveBeenCalled();
    expect(revealComponent).not.toHaveBeenCalled();
    expect(grid._rawAlertFocus).toHaveBeenCalledWith(undefined);
  });

  it('keeps working across repeated clicks on the same modal alert', () => {
    const field = { element: document.createElement('div'), refs: {} };
    const grid = makeGrid({ getComponent: vi.fn(() => field) });
    grid.addRowModal(0);

    grid.alert.focusOnComponent('a');
    grid.alert.focusOnComponent('a');

    expect(revealComponent).toHaveBeenCalledTimes(2);
    expect(grid.alert.__kaceRevealPatched).toBe(true);
  });
});

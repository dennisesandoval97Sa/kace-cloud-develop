import { describe, it, expect, vi } from 'vitest';

vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('@formio/react', () => {
  class FakeEditGrid {
    constructor(component = {}, options = {}, data = {}) {
      this.component = component;
      this.options = options;
      this.data = data;
    }
    static schema(obj) {
      return { ...obj };
    }
    static editForm(...args) {
      return { from: 'native-editgrid', args };
    }
  }
  return {
    Components: {
      components: { editgrid: FakeEditGrid },
      create: (c, o, d) => new FakeEditGrid(c, o, d),
      baseEditForm: (...args) => ({ args }),
    },
  };
});

const { default: EditGridComponent } = await import('./index.js');

describe('EditGridComponent pagination schema', () => {
  it('defaults pageSize to 10 and does not expose builder pagination flags', () => {
    const schema = EditGridComponent.schema();
    expect(schema.pageSize).toBe(10);
    expect(schema.paginationEnabled).toBeUndefined();
    expect(schema.paginationMode).toBeUndefined();
    expect(schema.paginationCode).toBeUndefined();
    expect(schema.kaceComponentId).toBe('kace_edit_grid');
    expect(schema.type).toBe('editgrid');
  });

  it('does not add a Paginación tab to editForm', () => {
    const result = EditGridComponent.editForm();
    const first = result.args[0];
    const tabs = Array.isArray(first) ? first : [];
    expect(tabs.some((tab) => tab?.key === 'pagination')).toBe(false);
  });

  it('does not patch the native editgrid editForm', async () => {
    const { Components } = await import('@formio/react');
    const result = Components.components.editgrid.editForm();
    expect(result.from).toBe('native-editgrid');
    expect(result.args).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      this.dataValue = [];
      this.refs = {};
      this.element = document.createElement('div');
      this.builderMode = false;
      this.disabled = false;
      this.key = component.key || 'editGrid';
    }
    static schema(obj) {
      return { ...obj };
    }
    t(text) {
      return text;
    }
    get rowRef() {
      return `editgrid-${this.key}-row`;
    }
    get rowElements() {
      return this.refs[this.rowRef] || [];
    }
    attach(element) {
      this.element = element || this.element;
      return this.element;
    }
    redraw() {
      return this.attach(this.element);
    }
    addRow() {
      if (this.options.readOnly) return;
      this.editRows.push({ data: {}, state: 'new', error: null });
      if (this.component.modal) return;
      const el = document.createElement('div');
      this.refs[this.rowRef] = [...this.rowElements, el];
      this.element.appendChild(el);
      return this.redraw();
    }
    editRow(rowIndex) {
      const row = this.editRows[rowIndex];
      if (row) row.state = 'editing';
      return this.redraw();
    }
    saveRow(rowIndex) {
      const row = this.editRows[rowIndex];
      if (row) {
        if (this.component.modal && row.state === 'new') {
          const el = document.createElement('div');
          this.refs[this.rowRef] = [...this.rowElements, el];
          this.element.appendChild(el);
          this.dataValue = [...(this.dataValue || []), row.data ?? {}];
        }
        row.state = 'saved';
      }
      return this.redraw();
    }
    cancelRow(rowIndex) {
      const row = this.editRows[rowIndex];
      if (row?.state === 'new') {
        this.editRows.splice(rowIndex, 1);
        this.refs[this.rowRef] = this.rowElements.filter(
          (_, i) => i !== rowIndex
        );
      }
      return this.redraw();
    }
    hasOpenRows() {
      return this.editRows.some(
        (row) => row?.state === 'new' || row?.state === 'editing'
      );
    }
    shouldSkipValidation() {
      return Boolean(this.skipValidation);
    }
    checkComponentValidity(data, dirty, row) {
      if (this.shouldSkipValidation(data, dirty, row)) return true;
      const superValid = this.superValid !== false;
      if (!superValid && !this.alert && !this.hasOpenRows()) return false;
      if (this.editRows.some((r) => r?.error || r?.errors?.length)) {
        return false;
      }
      if (dirty && this.hasOpenRows()) return false;
      return true;
    }
    checkData(data) {
      return this.checkComponentValidity(data, true);
    }
    setValue(value) {
      this.dataValue = Array.isArray(value) ? value : [];
    }
    updateValue(value) {
      this.dataValue = value;
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

const { default: EditGridComponent } = await import('./index.js');
const { PAGER_ROOT_CLASS, PAGER_TITLE_FIRST, PAGER_TITLE_NEXT } =
  await import('./pagination/edit-grid-pagination.constants.js');

const mountRows = (grid, n) => {
  const rows = Array.from({ length: n }, () => document.createElement('div'));
  grid.dataValue = rows.map((_, i) => ({ i }));
  grid.editRows = grid.dataValue.map((data) => ({ data, state: 'saved' }));
  grid.refs[grid.rowRef] = rows;
  rows.forEach((r) => grid.element.appendChild(r));
};

const navButton = (grid, title) =>
  grid.element.querySelector(`button[title="${title}"]`);

describe('EditGrid pagination adapter — local always on', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a pager by default without builder flags', () => {
    const grid = new EditGridComponent({ key: 'g' });
    mountRows(grid, 5);
    grid.attach(grid.element);
    expect(grid.element.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeTruthy();
    expect(grid.element.textContent).toContain('1 - 5 de 5');
    expect(grid.rowElements.every((el) => !el.hidden)).toBe(true);
  });

  it('does not render a pager when the component is hidden', () => {
    const grid = new EditGridComponent({
      key: 'g',
      pageSize: 10,
      hidden: true,
    });
    mountRows(grid, 25);
    grid.attach(grid.element);
    expect(grid.element.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeNull();
  });

  it('removes the pager when hidden is turned on after attach', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    expect(grid.element.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeTruthy();
    grid.component.hidden = true;
    grid.attach(grid.element);
    expect(grid.element.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeNull();
  });

  it('does not render a pager when Form.io visible is false', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.visible = false;
    grid.attach(grid.element);
    expect(grid.element.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeNull();
  });

  it('renders the pager again when hidden is turned off', () => {
    const grid = new EditGridComponent({
      key: 'g',
      pageSize: 10,
      hidden: true,
    });
    mountRows(grid, 25);
    grid.attach(grid.element);
    expect(grid.element.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeNull();
    grid.component.hidden = false;
    grid.attach(grid.element);
    expect(grid.element.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeTruthy();
  });

  it('hides off-page rows and keeps Formio indices', () => {
    const grid = new EditGridComponent({
      key: 'g',
      pageSize: 10,
    });
    mountRows(grid, 25);
    grid.attach(grid.element);
    expect(grid.rowElements.filter((el) => !el.hidden)).toHaveLength(10);
    expect(grid.rowElements[0].hidden).toBe(false);
    expect(grid.rowElements[10].hidden).toBe(true);
    expect(grid.element.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeTruthy();
    expect(grid.element.textContent).toContain('1 - 10 de 25');
  });

  it('keeps page navigation enabled in readOnly so hidden rows stay reachable', () => {
    const grid = new EditGridComponent(
      { key: 'g', pageSize: 10 },
      { readOnly: true }
    );
    mountRows(grid, 25);
    grid.attach(grid.element);
    expect(grid.rowElements.filter((el) => el.hidden)).toHaveLength(15);
    const next = navButton(grid, PAGER_TITLE_NEXT);
    expect(next.disabled).toBe(false);
    next.click();
    expect(grid._kacePage).toBe(2);
    expect(grid.rowElements[10].hidden).toBe(false);
    expect(grid.rowElements[0].hidden).toBe(true);
  });

  it('keeps a nested grid pager when the parent syncs', () => {
    const parent = new EditGridComponent({ key: 'parent', pageSize: 10 });
    const child = new EditGridComponent({ key: 'child', pageSize: 10 });
    mountRows(parent, 12);
    mountRows(child, 12);
    parent.rowElements[0].appendChild(child.element);
    child.attach(child.element);
    parent.attach(parent.element);
    expect(child.element.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeTruthy();
    expect(
      Array.from(parent.element.children).filter((el) =>
        el.classList.contains(PAGER_ROOT_CLASS)
      )
    ).toHaveLength(1);
  });

  it('jumps to the new inline row when Add overflows the current page', async () => {
    const grid = new EditGridComponent({
      key: 'g',
      pageSize: 2,
    });
    mountRows(grid, 2);
    grid.attach(grid.element);
    expect(grid.element.textContent).toContain('1 - 2 de 2');

    await grid.addRow();
    expect(grid._kacePage).toBe(2);
    expect(grid.dataValue).toHaveLength(2);
    expect(grid.editRows).toHaveLength(3);
    expect(grid.element.textContent).toContain('3 - 3 de 3');
    expect(grid.rowElements[2].hidden).toBe(false);
    expect(grid.rowElements[0].hidden).toBe(true);
  });

  it('keeps the current page when Add still fits on it', async () => {
    const grid = new EditGridComponent({
      key: 'g',
      pageSize: 2,
    });
    mountRows(grid, 1);
    grid.attach(grid.element);

    await grid.addRow();
    expect(grid._kacePage).toBe(1);
    expect(grid.element.textContent).toContain('1 - 2 de 2');
    expect(grid.rowElements.every((el) => !el.hidden)).toBe(true);
  });

  it('shows the unsaved New row when Add fills a new last page', async () => {
    const grid = new EditGridComponent({
      key: 'g',
      pageSize: 10,
    });
    mountRows(grid, 20);
    grid.attach(grid.element);
    expect(grid.element.textContent).toContain('1 - 10 de 20');

    await grid.addRow();
    expect(grid._kacePage).toBe(3);
    expect(grid.dataValue).toHaveLength(20);
    expect(grid.editRows).toHaveLength(21);
    expect(grid.element.textContent).toContain('21 - 21 de 21');
    expect(grid.rowElements[20].hidden).toBe(false);
    expect(grid.rowElements.filter((el) => !el.hidden)).toHaveLength(1);
  });

  it('does not jump after a modal add that is cancelled', async () => {
    const grid = new EditGridComponent({
      key: 'g',
      pageSize: 10,
      modal: true,
    });
    mountRows(grid, 25);
    grid.attach(grid.element);
    expect(grid._kacePage).toBe(1);

    grid.addRow();
    expect(grid._kacePage).toBe(1);
    expect(grid._kaceJumpToLastRowOnSync).toBeUndefined();
    expect(grid.editRows).toHaveLength(26);

    await grid.cancelRow(25);
    expect(grid._kacePage).toBe(1);
    expect(grid.editRows).toHaveLength(25);
    expect(grid.rowElements[0].hidden).toBe(false);
  });

  it('does not jump on a later attach after readOnly addRow', () => {
    const grid = new EditGridComponent(
      { key: 'g', pageSize: 10 },
      { readOnly: true }
    );
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.addRow();
    expect(grid.editRows).toHaveLength(25);
    expect(grid._kaceJumpToLastRowOnSync).toBeUndefined();
    grid.attach(grid.element);
    expect(grid._kacePage).toBe(1);
    expect(grid.rowElements[0].hidden).toBe(false);
  });

  it('reveals the first invalid row on a dirty submit', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.editRows[20].error = 'required';
    expect(grid.checkData()).toBe(false);
    expect(grid._kacePage).toBe(3);
    expect(grid.rowElements[20].hidden).toBe(false);
    expect(grid._kacePendingReveal == null).toBe(true);
  });

  it('lets the user change page while a row on another page is invalid', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.editRows[3].error = 'required';
    expect(grid.checkComponentValidity()).toBe(false);
    expect(grid._kacePage).toBe(1);
    const next = navButton(grid, PAGER_TITLE_NEXT);
    expect(next.disabled).toBe(false);
    next.click();
    expect(grid._kacePage).toBe(2);
    expect(grid.rowElements[10].hidden).toBe(false);
    expect(grid.rowElements[3].hidden).toBe(true);
  });

  it('does not render the pager from checkComponentValidity', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    const renderSpy = vi.spyOn(grid, '_kaceRenderPager');
    grid.editRows[20].error = 'required';
    expect(grid.checkComponentValidity()).toBe(false);
    expect(grid.checkComponentValidity()).toBe(false);
    expect(
      grid.checkComponentValidity(null, true, null, { silentCheck: true })
    ).toBe(false);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(grid._kacePage).toBe(1);
    expect(grid.rowElements[0].hidden).toBe(false);
    renderSpy.mockRestore();
  });

  it('keeps _kacePage unchanged across consecutive syncs with invalid rows', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.editRows[20].error = 'required';
    grid._kaceSyncPagination();
    expect(grid._kacePage).toBe(1);
    grid._kaceSyncPagination();
    expect(grid._kacePage).toBe(1);
  });

  it('does not hide the focused row as a side effect of checkComponentValidity', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    document.body.appendChild(grid.element);
    grid.attach(grid.element);
    const input = document.createElement('input');
    grid.rowElements[0].appendChild(input);
    input.focus();
    grid.editRows[20].error = 'required';
    expect(grid.checkComponentValidity()).toBe(false);
    expect(grid._kacePage).toBe(1);
    expect(grid.rowElements[0].hidden).toBe(false);
    expect(grid.rowElements[0].contains(document.activeElement)).toBe(true);
  });

  it('does not request reveal on silentCheck', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.editRows[20].error = 'required';
    expect(
      grid.checkComponentValidity(null, false, null, { silentCheck: true })
    ).toBe(false);
    expect(grid._kacePendingReveal == null).toBe(true);
    expect(grid._kacePage).toBe(1);
  });

  it('skips reveal when Formio shouldSkipValidation returns true', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.skipValidation = true;
    grid.editRows[20].error = 'required';
    expect(grid.checkComponentValidity()).toBe(true);
    expect(grid._kacePendingReveal == null).toBe(true);
    expect(grid._kacePage).toBe(1);
  });

  it('returns false on the Formio early exit without reading row errors', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.superValid = false;
    grid.alert = null;
    expect(grid.hasOpenRows()).toBe(false);
    expect(grid.checkComponentValidity()).toBe(false);
    expect(grid._kacePage).toBe(1);
  });

  it('reveals the row opened by editRow on another page', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.editRow(24);
    expect(grid._kacePage).toBe(3);
    expect(grid.rowElements[24].hidden).toBe(false);
    expect(grid.editRows[24].state).toBe('editing');
    expect(grid._kacePendingReveal == null).toBe(true);
  });

  it('reveals an editing row on another page when submit is dirty', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.editRows[24].state = 'editing';
    expect(grid.checkData()).toBe(false);
    expect(grid._kacePage).toBe(3);
    expect(grid.rowElements[24].hidden).toBe(false);
    expect(grid._kacePendingReveal == null).toBe(true);
  });

  it('reveals a modal-saved new row on another page', () => {
    const grid = new EditGridComponent({
      key: 'g',
      pageSize: 10,
      modal: true,
    });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.addRow();
    expect(grid._kacePage).toBe(1);
    grid.saveRow(25);
    expect(grid._kacePage).toBe(3);
    expect(grid.rowElements[25].hidden).toBe(false);
    expect(grid._kacePendingReveal == null).toBe(true);
  });

  it('reveals the new row when Add runs with an invalid row on another page', async () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 20);
    grid.attach(grid.element);
    grid.editRows[2].error = 'required';
    await grid.addRow();
    expect(grid._kacePage).toBe(3);
    expect(grid.rowElements[20].hidden).toBe(false);
    expect(grid._kacePendingReveal == null).toBe(true);
  });

  it('does not leave a pending reveal after public operations', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.addRow();
    expect(grid._kacePendingReveal == null).toBe(true);
    grid.editRow(0);
    expect(grid._kacePendingReveal == null).toBe(true);
    grid.checkData();
    expect(grid._kacePendingReveal == null).toBe(true);
    grid.saveRow(0);
    expect(grid._kacePendingReveal == null).toBe(true);
  });

  it('does not revert user navigation on a later checkData', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    grid.editRows[20].error = 'required';
    expect(grid.checkData()).toBe(false);
    expect(grid._kacePage).toBe(3);
    navButton(grid, PAGER_TITLE_FIRST).click();
    expect(grid._kacePage).toBe(1);
    expect(grid.checkData()).toBe(false);
    expect(grid._kacePage).toBe(1);
  });

  it('does not hide an open visible row on a later attach after checkData', () => {
    const grid = new EditGridComponent({ key: 'g', pageSize: 10 });
    mountRows(grid, 25);
    grid.attach(grid.element);
    navButton(grid, PAGER_TITLE_NEXT).click();
    navButton(grid, PAGER_TITLE_NEXT).click();
    expect(grid._kacePage).toBe(3);
    grid.editRows[24].state = 'editing';
    grid.editRows[0].error = 'required';
    expect(grid.checkData()).toBe(false);
    grid.attach(grid.element);
    expect(grid._kacePage).toBe(3);
    expect(grid.rowElements[24].hidden).toBe(false);
    expect(grid._kacePendingReveal == null).toBe(true);
  });
});

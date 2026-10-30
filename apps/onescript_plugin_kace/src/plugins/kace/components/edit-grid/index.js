import '#plugins/kace/shared/styles/kace-error-list.css';
import { Components } from '@formio/react';
import { storeService } from '#plugins/kace/services/storeService.js';
import { revealComponent } from '#plugins/kace/shared/FocusFormComponent.js';
import {
  DEFAULT_PAGE_SIZE,
  SCHEMA_KEY_PAGE_SIZE,
} from './pagination/edit-grid-pagination.constants.js';
import {
  clampPage,
  isIndexInPage,
  normalizePageSize,
  pageForIndex,
  pageWindow,
} from './pagination/edit-grid-pagination.js';
import {
  applyLocalRowVisibility,
  removePager,
  renderPager,
} from './pagination/edit-grid-pagination.view.js';
import './edit-grid.css';

const FormioComponent = Components.components.editgrid;

/** Prototipo del EditGrid de Form.io (tiene addRow, editRow, saveRow, cancelRow). */
const BaseEditGridProto =
  /** @type {{ addRow(): unknown; editRow(rowIndex: number): unknown; saveRow(rowIndex: number, modified: boolean): unknown; cancelRow(rowIndex: number): unknown }} */ (
    /** @type {unknown} */ (FormioComponent.prototype)
  );

/**
 * Form.io's EditGrid renders the row-edit modal's validation errors with its
 * own `Alert` component, whose `focusOnComponent` only calls
 * `component.focus()` — and this renderer's `Component.focus()` neither scrolls
 * the field into view nor reaches a React-rendered control (os-select /
 * custom-select / multiselect, none of which register `refs.input`). So
 * clicking an error in the row modal navigated nowhere. Wrap that
 * `Alert.focusOnComponent` (recreated on every `addRowModal`) so it also runs
 * `revealComponent` on the resolved field. Patched on the shared prototype so
 * it also covers the base (non-Kace) EditGrid used by older forms.
 *
 * @param {any} editGrid
 */
const patchRowModalAlertNavigation = (editGrid) => {
  const alert = editGrid?.alert;
  if (
    !alert ||
    alert.__kaceRevealPatched ||
    typeof alert.focusOnComponent !== 'function'
  ) {
    return;
  }
  const originalFocusOnComponent = alert.focusOnComponent.bind(alert);
  alert.focusOnComponent = (keyOrPath) => {
    originalFocusOnComponent(keyOrPath);
    if (!keyOrPath) return;
    try {
      const root = editGrid.root;
      const parentPath = editGrid._parentPath || '';
      const path = parentPath ? keyOrPath.replace(parentPath, '') : keyOrPath;
      const component =
        root && typeof root.getComponent === 'function'
          ? root.getComponent(path, null, keyOrPath)
          : null;
      if (component) revealComponent(component);
    } catch {
      // navigation is best-effort
    }
  };
  alert.__kaceRevealPatched = true;
};

if (!FormioComponent.prototype.__kaceRowModalAlertNavPatched) {
  const originalAddRowModal = FormioComponent.prototype.addRowModal;
  if (typeof originalAddRowModal === 'function') {
    FormioComponent.prototype.addRowModal = function (rowIndex) {
      const result = originalAddRowModal.call(this, rowIndex);
      patchRowModalAlertNavigation(this);
      return result;
    };
  }
  FormioComponent.prototype.__kaceRowModalAlertNavPatched = true;
}

/** Valor de `evento` para sesiones de dictado por voz (métricas independientes). */
export const KACE_EVENTO_TRANSCRIPCION = 'transcripcion';

/**
 * Se dispara tras persistir métricas desde el EditGrid para que el micrófono se detenga sin duplicar `sesiones`.
 * @type {string}
 */
export const KACE_VOICE_TRANSCRIPTION_FINALIZED_EXTERNALLY =
  'kace-voice-transcription-finalized-externally';

/**
 * Mapa global de transcripciones activas (solo cuando VoiceDictation está dentro de Kace EditGrid).
 * @typedef {object} KaceActiveVoiceTranscriptionSession
 * @property {string} inicio
 * @property {unknown} editGridComponent
 * @property {Record<string, unknown>} rowData
 * @property {string} elemento
 * @property {() => number} getCharCount
 */

/**
 * @returns {Map<string, KaceActiveVoiceTranscriptionSession> | null}
 */
export function getOrCreateKaceActiveVoiceTranscriptionsMap() {
  if (typeof window === 'undefined') return null;
  try {
    const w =
      /** @type {Window & { __kaceActiveVoiceTranscriptions?: Map<string, any> }} */ (
        window
      );
    if (!w.__kaceActiveVoiceTranscriptions) {
      w.__kaceActiveVoiceTranscriptions = new Map();
    }
    return w.__kaceActiveVoiceTranscriptions;
  } catch {
    return null;
  }
}

/**
 * Finaliza todas las transcripciones activas asociadas a este EditGrid (guardar, cancelar, cambio de fila).
 * @param {unknown} editGridComponent
 */
export function finalizeActiveVoiceTranscriptionsForEditGrid(
  editGridComponent
) {
  const map = getOrCreateKaceActiveVoiceTranscriptionsMap();
  if (!map || !editGridComponent) return;
  const fin = new Date().toISOString();
  /** @type {string[]} */
  const finalizedComponentIds = [];
  try {
    for (const [key, session] of map.entries()) {
      if (!session || session.editGridComponent !== editGridComponent) continue;
      try {
        const caracteres =
          typeof session.getCharCount === 'function'
            ? session.getCharCount()
            : 0;
        pushEventoEnRow(
          session.rowData,
          {
            inicio: session.inicio,
            fin,
            evento: KACE_EVENTO_TRANSCRIPCION,
            elemento: session.elemento,
            caracteres,
          },
          session.elemento
        );
      } catch (innerErr) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            '[Kace] finalizeActiveVoiceTranscriptionsForEditGrid',
            innerErr
          );
        }
      }
      map.delete(key);
      finalizedComponentIds.push(key);
    }
    if (
      finalizedComponentIds.length > 0 &&
      typeof window !== 'undefined' &&
      window.dispatchEvent
    ) {
      try {
        window.dispatchEvent(
          new CustomEvent(KACE_VOICE_TRANSCRIPTION_FINALIZED_EXTERNALLY, {
            detail: { componentIds: finalizedComponentIds },
          })
        );
      } catch (dispatchErr) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            '[Kace] finalizeActiveVoiceTranscriptionsForEditGrid dispatch',
            dispatchErr
          );
        }
      }
    }
  } catch (outerErr) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[Kace] finalizeActiveVoiceTranscriptionsForEditGrid',
        outerErr
      );
    }
  }
}

/**
 * Añade un evento de sesión al array sesiones del rowData.
 * @param {Record<string, unknown>} rowData - Datos de la fila
 * @param {{ inicio?: string | null; fin?: string | null; evento?: string; elemento?: string; caracteres?: number }} evento - Evento a registrar
 * @param {string} [elementoKey] - Key del elemento
 */
export function pushEventoEnRow(rowData, evento, elementoKey) {
  if (!rowData || typeof rowData !== 'object') return;
  const asesorId = storeService?.get?.('user.user_id');
  const sesiones = Array.isArray(rowData.sesiones) ? rowData.sesiones : [];
  /** @type {Record<string, unknown>} */
  const entry = {
    inicio: evento.inicio ?? null,
    fin: evento.fin ?? null,
    evento: evento.evento ?? '',
    elemento: elementoKey ?? '',
  };
  if (
    evento.caracteres != null &&
    typeof evento.caracteres === 'number' &&
    !Number.isNaN(evento.caracteres)
  ) {
    entry.caracteres = evento.caracteres;
  }
  if (asesorId) {
    entry.asesor = asesorId;
  }
  sesiones.push(entry);
  rowData.sesiones = sesiones;
}

/**
 * Editgrid que se comporta exactamente como el EditGrid base de Form.io
 * y registra sesiones (crear, editar, cancelar) en cada fila cuando modal está activo.
 * Usa type: 'editgrid' en el esquema para no romper la lógica interna de Form.io.
 * Para identificarlo en tu listado: component.kaceComponentId === EditGridComponent.KACE_COMPONENT_ID.
 */
export default class EditGridComponent extends FormioComponent {
  /** Tipo con el que se registra en el builder (aparece en el panel de Kace). */
  static get COMPONENT_TYPE() {
    return 'kace_edit_grid';
  }

  /**
   * Identificador para filtrar este editgrid en el listado de componentes.
   * En el esquema guardado: component.kaceComponentId === 'kace_edit_grid'
   */
  static get KACE_COMPONENT_ID() {
    return 'kace_edit_grid';
  }

  /**
   * Schema con type: 'editgrid' para comportamiento idéntico al base.
   * Incluye kaceComponentId para identificación en el listado.
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: 'editgrid',
      key: 'editGrid',
      label: 'Kace Edit Grid',
      kaceComponentId: EditGridComponent.KACE_COMPONENT_ID,
      [SCHEMA_KEY_PAGE_SIZE]: DEFAULT_PAGE_SIZE,
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Edit Grid',
      icon: 'th-list',
      preview: true,
      schema: EditGridComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm(...extend);
  };

  attach(element) {
    const result = super.attach(element);
    this._kaceSyncPagination();
    return result;
  }

  addRow() {
    finalizeActiveVoiceTranscriptionsForEditGrid(this);
    this._sesionCurrent = { inicio: new Date().toISOString() };
    this._sesionTipo = 'creacion';
    const newIndex = Array.isArray(this.editRows) ? this.editRows.length : 0;
    if (!this.component?.modal) this._kacePendingReveal = newIndex;
    try {
      return BaseEditGridProto.addRow.call(this);
    } finally {
      this._kacePendingReveal = null;
    }
  }

  /**
   * Edita una fila del grid. Si el modal se abrió desde open_view_modal.js (botón Ver en Hidden),
   * detecta la bandera en window y registra la sesión como "ver".
   * @param {*} rowIndex
   * @returns {unknown}
   */
  editRow(rowIndex) {
    finalizeActiveVoiceTranscriptionsForEditGrid(this);
    this._sesionCurrent = { inicio: new Date().toISOString() };
    const win =
      typeof window !== 'undefined'
        ? /** @type {Window & { __kaceEditGridOpenForView?: boolean }} */ (
            window
          )
        : null;
    if (win && win.__kaceEditGridOpenForView) {
      this._sesionTipo = 'ver';
      try {
        win.__kaceEditGridOpenForView = false;
      } catch {
        // window may be a restricted proxy
      }
    } else {
      this._sesionTipo = 'edicion';
    }
    if (typeof rowIndex === 'number' && rowIndex >= 0) {
      this._kacePendingReveal = rowIndex;
    }
    try {
      return BaseEditGridProto.editRow.call(this, rowIndex);
    } finally {
      this._kacePendingReveal = null;
    }
  }

  /**
   * Guarda una fila del grid.
   * @param {*} rowIndex
   * @param {*} modified
   * @returns
   */
  saveRow(rowIndex, modified) {
    finalizeActiveVoiceTranscriptionsForEditGrid(this);
    const key = this.component?.key;
    const current = this._sesionCurrent;
    const tipo = this._sesionTipo;
    const editRows = /** @type {{ data: Record<string, unknown> }[]} */ (
      this['editRows']
    );

    if (
      this.component.modal &&
      key &&
      current &&
      editRows &&
      editRows[rowIndex]
    ) {
      const rowData = editRows[rowIndex].data;
      const evento =
        tipo === 'edicion' ? 'edicion' : tipo === 'ver' ? 'ver' : 'creacion';
      pushEventoEnRow(
        rowData,
        {
          inicio: current.inicio,
          fin: new Date().toISOString(),
          evento,
          elemento: key,
        },
        key
      );
      this._sesionCurrent = null;
      this._sesionTipo = null;
    }
    const isModalNew =
      this.component?.modal && editRows?.[rowIndex]?.state === 'new';
    if (isModalNew) {
      this._kacePendingReveal = Array.isArray(this.dataValue)
        ? this.dataValue.length
        : 0;
    }
    try {
      return BaseEditGridProto.saveRow.call(this, rowIndex, modified);
    } finally {
      this._kacePendingReveal = null;
    }
  }

  /**
   * Cancela una fila del grid. Registra siempre el evento "cancelar" en sesiones cuando hay sesión activa.
   * @param {*} rowIndex
   * @returns {unknown}
   */
  cancelRow(rowIndex) {
    const key = this.component?.key;
    const current = this._sesionCurrent;
    const editRows =
      /** @type {{ data: Record<string, unknown>; backup?: Record<string, unknown> }[]} */ (
        this['editRows']
      );
    const dataValue = this.dataValue;

    const editRow = editRows?.[rowIndex];
    const rowDataForCancel =
      editRow != null
        ? (editRow.backup ?? editRow.data)
        : Array.isArray(dataValue)
          ? dataValue[rowIndex]
          : null;

    /**
     * Las transcripciones activas guardan `rowData` desde el hijo (p. ej. `editRow.data`).
     * En cancelación, `revision` se escribe en `backup ?? data`. Si no coinciden,
     * `transcripcion` y `revision` quedarían en objetos distintos y el payload no tendría ambos eventos.
     */
    try {
      if (rowDataForCancel && typeof rowDataForCancel === 'object') {
        const map = getOrCreateKaceActiveVoiceTranscriptionsMap();
        if (map) {
          for (const [, session] of map.entries()) {
            if (session && session.editGridComponent === this) {
              session.rowData = /** @type {Record<string, unknown>} */ (
                rowDataForCancel
              );
            }
          }
        }
      }
    } catch {
      // continuar con finalize
    }

    finalizeActiveVoiceTranscriptionsForEditGrid(this);

    try {
      if (this.component.modal && key && current) {
        if (rowDataForCancel && typeof rowDataForCancel === 'object') {
          const evento = {
            inicio: current.inicio,
            fin: new Date().toISOString(),
            evento: 'revision',
            elemento: key,
          };
          pushEventoEnRow(rowDataForCancel, evento, key);
          if (Array.isArray(dataValue) && dataValue[rowIndex] !== undefined) {
            dataValue[rowIndex] = rowDataForCancel;
            this.updateValue(dataValue, { modified: true }, 'cancelRow');
          }
        }
        this._sesionCurrent = null;
        this._sesionTipo = null;
      }
    } catch {
      this._sesionCurrent = null;
      this._sesionTipo = null;
    }
    return BaseEditGridProto.cancelRow.call(this, rowIndex);
  }

  checkComponentValidity(data, dirty, row, options) {
    const valid = super.checkComponentValidity(data, dirty, row, options);
    const becameInvalid =
      !valid && dirty && !options?.silentCheck && !this._kaceWasInvalid;
    this._kaceWasInvalid = !valid;
    if (becameInvalid && !this._kaceOpenRowVisible()) {
      const target = this._kaceRevealRowIndex();
      if (
        target >= 0 &&
        !isIndexInPage(target, this._kacePage, this._kacePageSize)
      ) {
        this._kacePage = pageForIndex(target, this._kacePageSize);
        this._kaceSyncPagination();
      }
    }
    return valid;
  }

  _kaceEnsureState() {
    this._kacePageSize = normalizePageSize(
      this._kacePageSize ?? this.component?.[SCHEMA_KEY_PAGE_SIZE]
    );
    if (this._kacePage == null) this._kacePage = 1;
  }

  /**
   * Unsaved New rows live in `editRows` / `rowElements` before `dataValue`.
   * The pager total is the max so that row stays reachable. lazyLoad or a
   * nested grid can make the three lengths differ; max is the conservative
   * visible count, not a claim that the sources stay equal.
   */
  _kaceLocalRowTotal() {
    const dataLen = Array.isArray(this.dataValue) ? this.dataValue.length : 0;
    const editLen = Array.isArray(this.editRows) ? this.editRows.length : 0;
    const elLen = this.rowElements?.length ?? 0;
    return Math.max(dataLen, editLen, elLen);
  }

  _kaceOpenRowIndex() {
    if (!Array.isArray(this.editRows)) return -1;
    return this.editRows.findIndex(
      (row) => row?.state === 'new' || row?.state === 'editing'
    );
  }

  _kaceOpenRowVisible() {
    this._kaceEnsureState();
    const open = this._kaceOpenRowIndex();
    return open >= 0 && isIndexInPage(open, this._kacePage, this._kacePageSize);
  }

  _kaceFirstInvalidRowIndex() {
    if (!Array.isArray(this.editRows)) return -1;
    return this.editRows.findIndex(
      (row) =>
        row?.error || (Array.isArray(row?.errors) && row.errors.length > 0)
    );
  }

  /**
   * Submit reveal order: operation target (`_kacePendingReveal` before `super`)
   * > open row (`new` | `editing`) off-page > first invalid.
   */
  _kaceRevealRowIndex() {
    this._kaceEnsureState();
    const open = this._kaceOpenRowIndex();
    if (open >= 0 && !isIndexInPage(open, this._kacePage, this._kacePageSize)) {
      return open;
    }
    return this._kaceFirstInvalidRowIndex();
  }

  /**
   * Form.io still attaches a `formio-hidden` shell when `component.hidden` or
   * `visible === false`. The wrapper CSS only zeros margin, so a pager
   * appended here would be the only visible piece of a hidden grid.
   */
  _kaceIsComponentHidden() {
    if (this.component?.hidden) return true;
    return this.visible === false;
  }

  /**
   * Sync points for the local pager:
   * - `_kaceSyncPagination` writes row visibility and the pager DOM. Callers:
   *   `attach()` (Form.io `redraw()` ends in `attach`), `_kaceOnPageChange`,
   *   `_kaceOnPageSizeChange`, and a dirty invalid transition in
   *   `checkComponentValidity` (no redraw on that path). Hidden components
   *   skip the write and remove any leftover pager (`component.hidden` or
   *   `visible === false`).
   * - `addRow` (inline), `editRow`, and modal `saveRow` of a `new` row set
   *   `_kacePendingReveal` to that operation's row immediately before `super`
   *   and clear it in `finally`. `redraw()` → `attach()` consumes it. Modal
   *   `addRow` does not set it: the row is not in the list until save.
   * - Submit (`checkComponentValidity` with `dirty` on the valid→invalid
   *   transition) applies the reveal immediately when the open row is not
   *   already visible. Later `checkData` does not re-arm a pending reveal.
   */
  _kaceSyncPagination() {
    if (this.builderMode) return;
    if (this._kaceIsComponentHidden()) {
      removePager(this.element);
      return;
    }
    this._kaceEnsureState();
    this._kaceTotal = this._kaceLocalRowTotal();
    const reveal = this._kacePendingReveal;
    this._kacePendingReveal = null;
    if (
      reveal != null &&
      !isIndexInPage(reveal, this._kacePage, this._kacePageSize)
    ) {
      this._kacePage = pageForIndex(reveal, this._kacePageSize);
    }
    this._kacePage = clampPage(
      this._kacePage,
      this._kaceTotal,
      this._kacePageSize
    );
    applyLocalRowVisibility(
      this.rowElements,
      this._kacePage,
      this._kacePageSize
    );
    this._kaceRenderPager();
  }

  _kaceOnPageChange(page) {
    this._kacePendingReveal = null;
    this._kacePage = page;
    this._kaceSyncPagination();
  }

  _kaceOnPageSizeChange(pageSize) {
    this._kacePageSize = normalizePageSize(pageSize, this._kacePageSize);
    this._kacePage = clampPage(
      this._kacePage,
      this._kaceTotal ?? 0,
      this._kacePageSize
    );
    this._kaceSyncPagination();
  }

  _kaceRenderPager() {
    const total =
      this._kaceTotal ??
      (Array.isArray(this.dataValue) ? this.dataValue.length : 0);
    const w = pageWindow({
      total,
      page: this._kacePage,
      pageSize: this._kacePageSize,
    });
    renderPager(this.element, {
      window: w,
      t: (text) => (typeof this.t === 'function' ? this.t(text) : text),
      onPageChange: (p) => this._kaceOnPageChange(p),
      onPageSizeChange: (s) => this._kaceOnPageSizeChange(s),
    });
  }
}

/**
 * Intercepta Components.create para usar nuestra clase solo cuando el componente
 * es "nuestro" editgrid (kaceComponentId), sin reemplazar el editgrid base de Form.io.
 * Así conviven: type 'editgrid' sin kaceComponentId → clase base; con kaceComponentId → EditGridComponent.
 */
const originalCreate = Components.create.bind(Components);
Components.create = function (component, options, data) {
  if (
    component &&
    component.type === 'editgrid' &&
    component.kaceComponentId === EditGridComponent.KACE_COMPONENT_ID
  ) {
    return new EditGridComponent(component, options, data);
  }
  return originalCreate(component, options, data);
};

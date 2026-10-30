import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import EditGridComponent, {
  getOrCreateKaceActiveVoiceTranscriptionsMap,
  KACE_EVENTO_TRANSCRIPCION,
  pushEventoEnRow,
} from '../edit-grid/index.js';
import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { VoiceDictation } from './VoiceDictation.jsx';

const FormioComponent = Components.components.field;

export default class VoiceDictationComponent extends FormioComponent {
  static get COMPONENT_TYPE() {
    return 'kace-d7726f06de2e45c3908377d10d9613df';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: VoiceDictationComponent.COMPONENT_TYPE,
      key: VoiceDictationComponent.COMPONENT_TYPE,
      label: 'Dictado por Voz',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Voice Dictation',
      icon: 'microphone', // https://fontawesome.com/v4/icons/
      preview: true,
      schema: VoiceDictationComponent.schema({ defaultValue: '' }),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  /**
   * Busca el Kace EditGrid ancestro (dictado solo registra métricas dentro del grid).
   * @returns {any | null}
   */
  _findParentEditGrid() {
    try {
      let p = this.parent;
      while (p) {
        if (
          p.component &&
          p.component.kaceComponentId === EditGridComponent.KACE_COMPONENT_ID
        ) {
          return p;
        }
        p = p.parent;
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Kace] VoiceDictationComponent._findParentEditGrid', err);
      }
    }
    return null;
  }

  /**
   * Persiste la sesión de transcripción y la elimina del mapa global.
   * @param {string} fin - ISO 8601
   * @param {number} caracteres - Longitud total del campo al cierre
   */
  _finalizeTranscriptionSessionIfActive(fin, caracteres) {
    try {
      const map = getOrCreateKaceActiveVoiceTranscriptionsMap();
      if (!map) return;
      const key = String(this.component.id);
      const session = map.get(key);
      if (!session) return;
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
      map.delete(key);
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[Kace] VoiceDictationComponent._finalizeTranscriptionSessionIfActive',
          err
        );
      }
    }
  }

  /**
   * Registra inicio de transcripción en el mapa global (solo si hay EditGrid ancestro).
   * @param {string} inicio - ISO 8601
   */
  _onVoiceTranscriptionStart(inicio) {
    try {
      const parentGrid = this._findParentEditGrid();
      if (!parentGrid) return;
      const map = getOrCreateKaceActiveVoiceTranscriptionsMap();
      if (!map) return;
      const elemento = String(this.component.key || '');
      map.set(String(this.component.id), {
        inicio,
        editGridComponent: parentGrid,
        rowData: /** @type {Record<string, unknown>} */ (this.data),
        elemento,
        getCharCount: () => String(this.getValue() ?? '').length,
      });
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[Kace] VoiceDictationComponent._onVoiceTranscriptionStart',
          err
        );
      }
    }
  }

  /**
   * @param {string} fin - ISO 8601
   * @param {number} caracteres
   */
  _onVoiceTranscriptionEnd(fin, caracteres) {
    this._finalizeTranscriptionSessionIfActive(fin, caracteres);
  }

  render() {
    const componentType = VoiceDictationComponent.COMPONENT_TYPE;
    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
    );
  }

  /**
   * @param {Element} element
   */
  attach(element) {
    this.reactRoot?.unmount();
    super.attach(element);

    const componentType = VoiceDictationComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode)
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );

    this.renderReactComponent();
  }

  /**
   * Render the React component with current value
   */
  renderReactComponent() {
    if (!this.reactRoot || this.builderMode) return;

    const parentGrid = this._findParentEditGrid();
    const onStart = parentGrid
      ? this._onVoiceTranscriptionStart.bind(this)
      : undefined;
    const onEnd = parentGrid
      ? this._onVoiceTranscriptionEnd.bind(this)
      : undefined;

    this.reactRoot.render(
      createElement(VoiceDictation, {
        component: this.component,
        value: this.getValue(),
        data: this.data,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        root: this.root,
        disabled: this.disabled,
        formioComponentId: String(this.component.id),
        onTranscriptionStart: onStart,
        onTranscriptionEnd: onEnd,
      })
    );
  }

  /**
   * Override setValue to re-render React component when value changes
   */
  setValue(value, flags = {}) {
    const changed = super.setValue(value, flags);
    if (changed && !this.builderMode && !flags.modified) {
      this.renderReactComponent();
    }
    return changed;
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (!this.builderMode) {
      this.renderReactComponent();
    }
  }

  detach() {
    try {
      const map = getOrCreateKaceActiveVoiceTranscriptionsMap();
      if (map && map.has(String(this.component.id))) {
        const fin = new Date().toISOString();
        const session = map.get(String(this.component.id));
        const caracteres =
          session && typeof session.getCharCount === 'function'
            ? session.getCharCount()
            : String(this.getValue() ?? '').length;
        this._finalizeTranscriptionSessionIfActive(fin, caracteres);
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Kace] VoiceDictationComponent.detach', err);
      }
    }
    this.reactRoot?.unmount();
    super.detach();
  }
}

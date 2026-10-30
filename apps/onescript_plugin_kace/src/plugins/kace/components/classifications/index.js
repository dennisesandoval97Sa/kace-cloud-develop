import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import customTabEditForm from './custom.form.json';
import { Classifications } from './Classifications.jsx';

const FormioComponent = Components.components.container;

export default class ClassificationsComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'classification_id';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: ClassificationsComponent.COMPONENT_TYPE,
      key: ClassificationsComponent.COMPONENT_TYPE,
      label: 'Classifications',
      classificationsInitCode: '',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Classifications',
      icon: 'tags', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: ClassificationsComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = ClassificationsComponent.COMPONENT_TYPE;
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

    const componentType = ClassificationsComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode)
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );

    this.root.submission.data = this.root.submission.data || {};

    /**
     * Único punto donde se emite hacia fuera. Todo evento va en `this` Y en el root del formulario:
     * los listeners registrados con `onEvent` cuelgan del componente, y los de otros componentes
     * (AuxCasesSchema, useStates) cuelgan del root. Emitir en uno solo los deja sin ver el evento.
     */
    this.emitKaceEvent = (name, payload) => {
      this.emit(name, payload);
      const formRoot = this.root?.globalRoot ?? this.root;
      formRoot?.emit?.(name, payload);
    };

    this.handleClassificationChange = (key, value) => {
      if (key === undefined || key === null) {
        return;
      }

      const clearedValue = value === undefined ? null : value;

      if (key === 'flujo_id') {
        this.root.submission.data[key] = clearedValue;
        this.emitKaceEvent('kaceClassificationsFlowChange', clearedValue);
        return;
      }

      if (!this.root.submission.data.case_data) {
        this.root.submission.data.case_data = {};
      }

      if (!this.root.submission.data.case_data.case) {
        this.root.submission.data.case_data.case = {};
      }

      this.root.submission.data.case_data.case[key] = clearedValue;

      if (!this.root.data) {
        this.root.data = {};
      }
      this.root.data[key] = clearedValue;

      if (key === 'clasificacion_id') {
        const isClearing = clearedValue === null || clearedValue === undefined;
        // Aquí NO se usa `emitKaceEvent`: `updateValue` va deliberadamente entre ambos emits y
        // mover el del root detrás cambiaría el orden en que Form.io ve el valor nuevo.
        this.emit('kaceClassificationsChange', clearedValue);
        this.updateValue(clearedValue, {
          modified: true,
          resetValue: isClearing,
        });
        const formRoot = this.root?.globalRoot ?? this.root;
        formRoot?.emit?.('kaceClassificationsChange', clearedValue);
      }
    };
    this.renderReactComponent();
  }

  renderReactComponent() {
    if (!this.reactRoot || this.builderMode) return;
    this.reactRoot.render(
      createElement(Classifications, {
        handleChange: this.handleClassificationChange,
        emitEvent: this.emitKaceEvent,
        root: this.root,
        disabled: this.disabled,
        component: this.component,
        data: this.data ?? this.root?.data ?? {},
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    this.renderReactComponent();
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}

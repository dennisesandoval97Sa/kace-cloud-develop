import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { CustomMultiselect } from './CustomMultiselect.jsx';
import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const KaceMultiselectBase = KaceBaseComponent.create({
  componentType: 'custom-multiselect',
  formioBaseComponent: 'field',
  builderInfo: {
    title: 'Kace Custom Multiselect',
    icon: 'list-ol',
    preview: true,
  },
});

export default class CustomMultiselectComponent extends KaceMultiselectBase {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'custom-multiselect';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return KaceMultiselectBase.schema({
      type: CustomMultiselectComponent.COMPONENT_TYPE,
      key: CustomMultiselectComponent.COMPONENT_TYPE,
      label: 'Custom Multiselect',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Custom Multiselect',
      icon: 'list-ol', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: CustomMultiselectComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = CustomMultiselectComponent.COMPONENT_TYPE;
    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
    );
  }

  /**
   * @param {Element} element
   */
  attach(element) {
    if (this.root?.off && this._onRootFormChange) {
      this.root.off('change', this._onRootFormChange);
      this._onRootFormChange = null;
    }
    this.reactRoot?.unmount();
    const attachResult = super.attach(element);

    const componentType = CustomMultiselectComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return attachResult;
    this.reactRoot = createRoot(elem);

    if (this.builderMode) {
      this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );
      return attachResult;
    }

    this.renderReactComponent();
    if (this.root?.on && this.component.dependsOn) {
      this._onRootFormChange = () => {
        this.syncDependencyRenderFromData();
      };
      this.root.on('change', this._onRootFormChange);
    }
    return attachResult;
  }

  syncDependencyRenderFromData() {
    const depKey = this.component.dependsOn;
    if (!depKey || this.builderMode || !this.reactRoot) return;
    let sig = '';
    try {
      sig = JSON.stringify(this.data?.[depKey] ?? null);
    } catch {
      sig = '';
    }
    if (sig === this._lastDependencySignature) return;
    this.renderReactComponent();
  }

  /**
   * Vuelve a montar el árbol React con el valor actual de Form.io.
   * Necesario porque la submission puede hidratarse después del primer attach
   * (getValue() era null en el primer render).
   */
  renderReactComponent() {
    if (!this.reactRoot || this.builderMode) return;

    const depKey = this.component.dependsOn;
    const depValue = depKey ? this.data?.[depKey] : undefined;
    let depSignature = '';
    if (depKey) {
      try {
        depSignature = JSON.stringify(depValue ?? null);
      } catch {
        depSignature = '';
      }
    }
    const dependencyChanged =
      Boolean(depKey) &&
      this._dependencySignatureForPrune !== undefined &&
      this._dependencySignatureForPrune !== depSignature;
    if (depKey) {
      this._lastDependencySignature = depSignature;
      this._dependencySignatureForPrune = depSignature;
    } else {
      this._lastDependencySignature = undefined;
      this._dependencySignatureForPrune = undefined;
    }

    this.reactRoot.render(
      createElement(CustomMultiselect, {
        component: this.component,
        values: this.getValue(),
        data: this.data,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        disabled: this.disabled,
        dependencyValue: depValue,
        dependencyChanged,
      })
    );
  }

  /** @param {any} data @param {any} flags @param {any} row */
  checkData(data, flags, row) {
    const result = super.checkData(data, flags, row);
    if (!this.builderMode) {
      this.syncDependencyRenderFromData();
    }
    return result;
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

  /**
   * Normaliza el valor del campo a array para el componente React.
   * @returns {unknown[]}
   */
  getValue() {
    const value = this.dataValue ?? this.data?.[this.component.key];

    if (value === undefined || value === null || value === '') {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  redraw() {
    const result = super.redraw();
    if (!this.builderMode && this.reactRoot) {
      this.renderReactComponent();
    }
    return result;
  }

  setCustomValidity(message, dirty) {
    const isRawValidationPayload = (msg) => {
      if (typeof msg === 'string') {
        return /"message"/.test(msg) && /"context"/.test(msg);
      }
      if (Array.isArray(msg)) {
        return msg.some(
          (item) => item?.message != null && item?.context != null
        );
      }
      if (msg && typeof msg === 'object') {
        return msg.message != null && msg.context != null;
      }
      return false;
    };
    if (isRawValidationPayload(message)) {
      if (this.error) this.error = null;
      return;
    }
    super.setCustomValidity(message, dirty);
  }

  detach() {
    if (this.root?.off && this._onRootFormChange) {
      this.root.off('change', this._onRootFormChange);
      this._onRootFormChange = null;
    }
    this.reactRoot?.unmount();
    return super.detach();
  }
}

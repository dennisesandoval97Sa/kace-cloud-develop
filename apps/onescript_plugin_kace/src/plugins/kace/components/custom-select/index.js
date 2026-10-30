import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { CustomSelect } from './CustomSelect.jsx';
import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const KaceSelectBase = KaceBaseComponent.create({
  componentType: 'custom-select',
  formioBaseComponent: 'field',
  builderInfo: {
    title: 'Kace CustomSelect',
    icon: 'superpowers',
    preview: true,
  },
});

export default class CustomSelectComponent extends KaceSelectBase {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'custom-select';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return KaceSelectBase.schema({
      type: CustomSelectComponent.COMPONENT_TYPE,
      key: CustomSelectComponent.COMPONENT_TYPE,
      label: 'Custom Select',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace CustomSelect',
      icon: 'superpowers', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: CustomSelectComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = CustomSelectComponent.COMPONENT_TYPE;
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

    const componentType = CustomSelectComponent.COMPONENT_TYPE;
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
   * Render the React component with current value
   */
  renderReactComponent() {
    if (!this.reactRoot || this.builderMode) return;

    const depKey = this.component.dependsOn;
    const depValue = depKey ? this.data?.[depKey] : undefined;
    if (depKey) {
      try {
        this._lastDependencySignature = JSON.stringify(depValue ?? null);
      } catch {
        this._lastDependencySignature = '';
      }
    } else {
      this._lastDependencySignature = undefined;
    }

    this.reactRoot.render(
      createElement(CustomSelect, {
        component: this.component,
        value: this.getValue(),
        data: this.data,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        root: this.root,
        disabled: this.disabled,
        dependencyValue: depValue,
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

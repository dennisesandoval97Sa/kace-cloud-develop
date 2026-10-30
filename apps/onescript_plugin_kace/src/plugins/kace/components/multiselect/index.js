import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { Multiselect } from './Multiselect.jsx';
import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const KaceMultiselectBase = KaceBaseComponent.create({
  componentType: 'multiselect',
  formioBaseComponent: 'field',
  builderInfo: {
    title: 'Kace Multiselect',
    icon: 'list-ul',
    preview: true,
  },
});

export default class MultiselectComponent extends KaceMultiselectBase {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'multiselect';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return KaceMultiselectBase.schema({
      type: MultiselectComponent.COMPONENT_TYPE,
      key: MultiselectComponent.COMPONENT_TYPE,
      label: 'Multiselect',
      multiple: true,
      defaultValue: [],
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Multiselect',
      icon: 'list-ul', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: MultiselectComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = MultiselectComponent.COMPONENT_TYPE;
    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
    );
  }

  /**
   * @param {Element} element
   */
  attach(element) {
    this.reactRoot?.unmount();
    const attachResult = super.attach(element);

    const componentType = MultiselectComponent.COMPONENT_TYPE;
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
    return attachResult;
  }

  /**
   * Render the React component with current value
   */
  renderReactComponent() {
    if (!this.reactRoot || this.builderMode) return;

    this.reactRoot.render(
      createElement(Multiselect, {
        component: this.component,
        values: this.getValue(),
        data: this.data,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        disabled: this.disabled,
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

  /**
   * Override getValue to ensure we return the correct value as array
   */
  getValue() {
    const value = this.data?.[this.component.key];
    // Si no hay valor, retornar array vacío
    if (value === undefined || value === null || value === '') {
      return [];
    }
    // Asegurar que siempre sea un array
    return Array.isArray(value) ? value : [value];
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
    this.reactRoot?.unmount();
    return super.detach();
  }
}

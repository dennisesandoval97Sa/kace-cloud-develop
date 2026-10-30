import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { CustomAuxLiteralsList } from './CustomAuxLiteralsList.jsx';
import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const KaceAuxLiteralsBase = KaceBaseComponent.create({
  componentType: 'custom-aux-literals-list',
  formioBaseComponent: 'base',
  builderInfo: {
    title: 'Kace CustomAuxLiteralsList',
    icon: 'list-alt',
    preview: true,
  },
});

export default class CustomAuxLiteralsListComponent extends KaceAuxLiteralsBase {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'custom-aux-literals-list';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return KaceAuxLiteralsBase.schema({
      type: CustomAuxLiteralsListComponent.COMPONENT_TYPE,
      key: CustomAuxLiteralsListComponent.COMPONENT_TYPE,
      label: 'Custom Auxiliary Literals List',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace CustomAuxLiteralsList',
      icon: 'list-alt', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: CustomAuxLiteralsListComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = CustomAuxLiteralsListComponent.COMPONENT_TYPE;
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

    const componentType = CustomAuxLiteralsListComponent.COMPONENT_TYPE;
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

    const currentValue =
      this.data?.[this.component.key] ||
      this.root?.submission?.data?.[this.component.key] ||
      this.root?.data?.[this.component.key] ||
      '';

    this.reactRoot.render(
      createElement(CustomAuxLiteralsList, {
        component: this.component,
        value: currentValue,
        updateValue: this.updateValue.bind(this),
        disabled: this.disabled,
      })
    );
  }

  /**
   * Override setValue to sync with React component
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
   * Override getValue to ensure we return the correct value
   */
  getValue() {
    return this.data?.[this.component.key] || '';
  }

  detach() {
    this.reactRoot?.unmount();
    return super.detach();
  }
}

import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import customTabEditForm from './custom.form.json';
import { SelectReferenceAuxiliaries } from './SelectReferenceAuxiliaries.jsx';
import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const KaceSelectRefAuxBase = KaceBaseComponent.create({
  componentType: 'select-reference-auxiliaries',
  formioBaseComponent: 'base',
  builderInfo: {
    title: 'Kace Select Reference Auxiliaries',
    icon: 'sitemap',
    preview: true,
  },
});

export default class SelectReferenceAuxiliariesComponent extends KaceSelectRefAuxBase {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'select-reference-auxiliaries';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return KaceSelectRefAuxBase.schema({
      type: SelectReferenceAuxiliariesComponent.COMPONENT_TYPE,
      key: SelectReferenceAuxiliariesComponent.COMPONENT_TYPE,
      label: 'Select Reference Auxiliaries',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Select Reference Auxiliaries',
      icon: 'sitemap', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: SelectReferenceAuxiliariesComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = SelectReferenceAuxiliariesComponent.COMPONENT_TYPE;
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

    const componentType = SelectReferenceAuxiliariesComponent.COMPONENT_TYPE;
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
      {};

    this.reactRoot.render(
      createElement(SelectReferenceAuxiliaries, {
        component: this.component,
        value: currentValue,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
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
    return this.data?.[this.component.key] || {};
  }

  detach() {
    this.reactRoot?.unmount();
    return super.detach();
  }
}

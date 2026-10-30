import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import customTabEditForm from './custom.form.json';
import { OsSelect } from './OsSelect.jsx';
import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const KaceSelectBase = KaceBaseComponent.create({
  componentType: 'os-select',
  formioBaseComponent: 'base',
  builderInfo: {
    title: 'Kace Dynamic Select',
    icon: 'list',
    preview: true,
  },
});

export default class OsSelectComponent extends KaceSelectBase {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'os-select';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return KaceSelectBase.schema({
      type: OsSelectComponent.COMPONENT_TYPE,
      key: OsSelectComponent.COMPONENT_TYPE,
      label: 'Dynamic Select',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Dynamic Select',
      icon: 'list', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: OsSelectComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = OsSelectComponent.COMPONENT_TYPE;
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

    const componentType = OsSelectComponent.COMPONENT_TYPE;
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
    if (
      typeof this.reactRoot._internalRoot === 'undefined' ||
      this.reactRoot._internalRoot === null
    )
      return;

    const currentValue =
      this.data?.[this.component.key] ||
      this.root?.submission?.data?.[this.component.key] ||
      this.root?.data?.[this.component.key] ||
      '';

    this.reactRoot.render(
      createElement(OsSelect, {
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
      if (
        this.reactRoot &&
        typeof this.reactRoot._internalRoot !== 'undefined' &&
        this.reactRoot._internalRoot !== null
      ) {
        this.renderReactComponent();
      }
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

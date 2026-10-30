import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { Drawer } from './Drawer.jsx';

const FormioComponent = Components.components.container;

// Use this custom error instead of the default generic error

export default class DrawerComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'kace-c55d385e9ce64ffdb57bdc0a8f6f8ae6';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: DrawerComponent.COMPONENT_TYPE,
      key: DrawerComponent.COMPONENT_TYPE,
      label: 'Drawer Component',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Estados (Drawer) Component',
      icon: 'superpowers', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: DrawerComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm(
      [
        // customize your editForm tabs
        customTabEditForm,
      ],
      ...extend
    );
  };

  render() {
    const componentType = DrawerComponent.COMPONENT_TYPE;
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

    const componentType = DrawerComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode)
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );

    this.reactRoot.render(
      createElement(Drawer, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        root: this.root,
        disabled: this.disabled,
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (!this.reactRoot || this.builderMode) return;
    this.reactRoot.render(
      createElement(Drawer, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        root: this.root,
        disabled: this.disabled,
      })
    );
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}

import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { Timer } from './Timer.jsx';

const FormioComponent = Components.components.container;

export default class TimerComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'kace-8605364010b345b5b6dffda3f79533aa';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: TimerComponent.COMPONENT_TYPE,
      key: TimerComponent.COMPONENT_TYPE,
      label: 'Timer Component',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Timer',
      icon: 'clock-o', // https://fontawesome.com/v4/icons/
      preview: false, // This is how you can hide/show the preview column in editForm modal
      schema: TimerComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm(
      [
        // customize your editForm tabs
      ],
      ...extend
    );
  };

  render() {
    const componentType = TimerComponent.COMPONENT_TYPE;
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

    const componentType = TimerComponent.COMPONENT_TYPE;
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
      createElement(Timer, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        root: this.root,
        disabled: this.disabled,
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (!this.reactRoot || this.builderMode) return;
    this.reactRoot.render(
      createElement(Timer, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
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

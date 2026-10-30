import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { Schema } from './Schema.jsx';

const FormioComponent = Components.components.container;

export default class SchemaComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'kace_schema';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: SchemaComponent.COMPONENT_TYPE,
      key: SchemaComponent.COMPONENT_TYPE,
      label: 'Schema Component',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Schema',
      icon: 'superpowers', // https://fontawesome.com/v4/icons/
      preview: false, // This is how you can hide/show the preview column in editForm modal
      schema: SchemaComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = SchemaComponent.COMPONENT_TYPE;
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

    const componentType = SchemaComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode)
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );

    const emitTarget = this.root?.globalRoot ?? this.root;

    this.reactRoot.render(
      createElement(Schema, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        root: this.root,
        globalRoot: emitTarget,
        emit:
          typeof emitTarget?.emit === 'function'
            ? emitTarget.emit.bind(emitTarget)
            : undefined,
        disabled: this.disabled,
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (!this.reactRoot || this.builderMode) return;
    const emitTarget = this.root?.globalRoot ?? this.root;
    this.reactRoot.render(
      createElement(Schema, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        root: this.root,
        globalRoot: emitTarget,
        emit:
          typeof emitTarget?.emit === 'function'
            ? emitTarget.emit.bind(emitTarget)
            : undefined,
        disabled: this.disabled,
      })
    );
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}

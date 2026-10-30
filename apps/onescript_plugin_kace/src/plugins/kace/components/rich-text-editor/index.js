import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { RichTextEditor } from './RichTextEditor.jsx';

const FormioComponent = Components.components.container;

export default class RichTextEditorComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'kace_description';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: RichTextEditorComponent.COMPONENT_TYPE,
      key: RichTextEditorComponent.COMPONENT_TYPE,
      label: 'Description',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Description',
      icon: 'edit', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: RichTextEditorComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm(...extend);
  };

  render() {
    const componentType = RichTextEditorComponent.COMPONENT_TYPE;
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

    const componentType = RichTextEditorComponent.COMPONENT_TYPE;
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
      createElement(RichTextEditor, {
        onEvent: this.on.bind(this),
        updateValue: this.updateValue.bind(this),
        disabled: this.disabled,
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (!this.reactRoot || this.builderMode) return;
    this.reactRoot.render(
      createElement(RichTextEditor, {
        onEvent: this.on.bind(this),
        updateValue: this.updateValue.bind(this),
        disabled: this.disabled,
      })
    );
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}

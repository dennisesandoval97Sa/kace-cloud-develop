import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { Attachment } from './Attachment.jsx';
import customEditForm from './custom.form.json';
import {
  SCHEMA_KEY_ATTACHMENT_HIDDEN,
  SCHEMA_KEY_ATTACHMENT_HIDDEN_INITIAL,
} from '#plugins/kace/shared/kace-events.constants.js';

const FormioComponent = Components.components.container;

export default class AttachmentComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'kace_attachment';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: AttachmentComponent.COMPONENT_TYPE,
      key: AttachmentComponent.COMPONENT_TYPE,
      label: 'Attachment',
      [SCHEMA_KEY_ATTACHMENT_HIDDEN]: null,
      [SCHEMA_KEY_ATTACHMENT_HIDDEN_INITIAL]: false,
      classificationMode: 'none',
      attachmentTypes: [],
      tipoFotoItems: [],
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Attachment',
      icon: 'paperclip', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: AttachmentComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customEditForm], ...extend);
  };

  render() {
    const componentType = AttachmentComponent.COMPONENT_TYPE;
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

    const componentType = AttachmentComponent.COMPONENT_TYPE;
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
      createElement(Attachment, {
        onEvent: this.on.bind(this),
        root: this.root,
        component: this.component,
        disabled: this.disabled,
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (this.reactRoot && !this.builderMode) {
      this.reactRoot.render(
        createElement(Attachment, {
          onEvent: this.on.bind(this),
          root: this.root,
          component: this.component,
          disabled: this.disabled,
        })
      );
    }
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}

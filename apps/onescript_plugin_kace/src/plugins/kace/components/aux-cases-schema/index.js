import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { AuxCasesSchema } from './AuxCasesSchema.jsx';

const FormioComponent = Components.components.container;

/**
 * @param {any} ctx
 * @returns {Function | undefined}
 */
function bindEmit(ctx) {
  if (ctx == null || typeof ctx.emit !== 'function') return undefined;
  return ctx.emit.bind(ctx);
}

export default class AuxCasesSchemaComponent extends FormioComponent {
  static get COMPONENT_TYPE() {
    return 'kace_aux_cases_schema';
  }

  static schema(...extend) {
    return FormioComponent.schema({
      type: AuxCasesSchemaComponent.COMPONENT_TYPE,
      key: AuxCasesSchemaComponent.COMPONENT_TYPE,
      label: 'Aux Cases Schema',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Aux Cases Schema',
      icon: 'puzzle-piece',
      preview: false,
      schema: AuxCasesSchemaComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = AuxCasesSchemaComponent.COMPONENT_TYPE;
    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
    );
  }

  attach(element) {
    this.reactRoot?.unmount();
    super.attach(element);

    const componentType = AuxCasesSchemaComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode) {
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );
    }

    const globalRoot = this.root?.globalRoot ?? this.root;
    const emit = bindEmit(globalRoot) ?? bindEmit(this.root) ?? bindEmit(this);

    this.reactRoot.render(
      createElement(AuxCasesSchema, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        root: this.root,
        globalRoot,
        emit,
        disabled: this.disabled,
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (!this.reactRoot || this.builderMode) return;

    const globalRoot = this.root?.globalRoot ?? this.root;
    const emit = bindEmit(globalRoot) ?? bindEmit(this.root) ?? bindEmit(this);

    this.reactRoot.render(
      createElement(AuxCasesSchema, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        root: this.root,
        globalRoot,
        emit,
        disabled: this.disabled,
      })
    );
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}

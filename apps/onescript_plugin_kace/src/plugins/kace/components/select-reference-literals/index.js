import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { SelectReferenceLiterals } from './SelectReferenceLiterals.jsx';
import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const KaceSelectRefLiteralsBase = KaceBaseComponent.create({
  componentType: 'select-reference-literals',
  formioBaseComponent: 'base',
  builderInfo: {
    title: 'Kace Select Reference Literals',
    icon: 'list',
    preview: true,
  },
});

export default class SelectReferenceLiteralsComponent extends KaceSelectRefLiteralsBase {
  static get COMPONENT_TYPE() {
    return 'select-reference-literals';
  }

  static schema(...extend) {
    return KaceSelectRefLiteralsBase.schema({
      type: SelectReferenceLiteralsComponent.COMPONENT_TYPE,
      key: SelectReferenceLiteralsComponent.COMPONENT_TYPE,
      label: 'Choose an option',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Select Reference Literals',
      icon: 'list',
      preview: true,
      schema: SelectReferenceLiteralsComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = SelectReferenceLiteralsComponent.COMPONENT_TYPE;
    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
    );
  }

  attach(element) {
    this.reactRoot?.unmount();
    const attachResult = super.attach(element);

    const componentType = SelectReferenceLiteralsComponent.COMPONENT_TYPE;
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

  renderReactComponent() {
    if (!this.reactRoot || this.builderMode) return;

    const currentValue =
      this.data?.[this.component.key] ||
      this.root?.submission?.data?.[this.component.key] ||
      this.root?.data?.[this.component.key] ||
      {};

    this.reactRoot.render(
      createElement(SelectReferenceLiterals, {
        component: this.component,
        value: currentValue,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        disabled: this.disabled,
      })
    );
  }

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

  getValue() {
    return this.data?.[this.component.key] || {};
  }

  detach() {
    this.reactRoot?.unmount();
    return super.detach();
  }
}

import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import customTabEditForm from './custom.form.json';
import accionesTabEditForm from './acciones.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { DataTable } from './DataTable.jsx';

const FormioComponent = Components.components.base;

export default class DataTableComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'kace-5881fcf9aaaa4c3b8bc37a3281704634';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: DataTableComponent.COMPONENT_TYPE,
      key: DataTableComponent.COMPONENT_TYPE,
      label: 'DataTable Component',
      bulkActions: [],
      bulkActionsContextCode: '',
      horizontalScroll: true,
      pinActionsColumn: false,
      columnResizeEnabled: true,
      combinedBulkActionsModal: false,
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'DataTable Component',
      icon: 'table', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: DataTableComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm(
      [
        { key: 'display', ignore: true },
        { key: 'api', ignore: true },
        { key: 'conditions', ignore: true },
        { key: 'conditional', ignore: true },
        { key: 'logic', ignore: true },
        { key: 'layout', ignore: true },
        { key: 'data', ignore: true },
        { key: 'validation', ignore: true },
        { key: 'addons', ignore: true },
        customTabEditForm,
        accionesTabEditForm,
      ],
      ...extend
    );
  };

  render() {
    const componentType = DataTableComponent.COMPONENT_TYPE;
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

    const componentType = DataTableComponent.COMPONENT_TYPE;
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
      createElement(DataTable, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        disabled: this.disabled,
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (!this.reactRoot || this.builderMode) return;
    this.reactRoot.render(
      createElement(DataTable, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        disabled: this.disabled,
      })
    );
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}

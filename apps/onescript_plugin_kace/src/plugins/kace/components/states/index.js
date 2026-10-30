import { Components } from '@formio/react';
import { createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { States } from './States.jsx';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import customEditForm from './custom.form.json';
import {
  SCHEMA_KEY_STATES_HIDE_CODE,
  SCHEMA_KEY_STATES_ON_CHANGE_CODE,
  SCHEMA_KEY_STATES_ON_MOUNT_CODE,
} from '#plugins/kace/shared/kace-events.constants.js';

const FormioComponent = Components.components.container;

export default class StatesComponent extends FormioComponent {
  static get COMPONENT_TYPE() {
    return 'kace_states';
  }

  static schema(...extend) {
    return FormioComponent.schema({
      type: StatesComponent.COMPONENT_TYPE,
      key: StatesComponent.COMPONENT_TYPE,
      label: 'States',
      hideLabel: true,
      [SCHEMA_KEY_STATES_ON_MOUNT_CODE]: null,
      [SCHEMA_KEY_STATES_ON_CHANGE_CODE]: null,
      [SCHEMA_KEY_STATES_HIDE_CODE]: null,
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace States',
      icon: 'gg-circle', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: StatesComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customEditForm], ...extend);
  };

  render() {
    const componentType = StatesComponent.COMPONENT_TYPE;
    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
    );
  }

  syncStateToFormData(transitionId, stateId = null) {
    if (!this.root.submission.data) {
      this.root.submission.data = {};
    }
    if (!this.root.submission.data.case_data) {
      this.root.submission.data.case_data = {};
    }
    if (!this.root.submission.data.case_data.case) {
      this.root.submission.data.case_data.case = {};
    }
    this.root.submission.data.case_data.case.transicion_id = transitionId;
    this.root.submission.data.state_id = stateId;

    if (!this.root.data) {
      this.root.data = {};
    }
    if (!this.root.data.case_data) {
      this.root.data.case_data = {};
    }
    if (!this.root.data.case_data.case) {
      this.root.data.case_data.case = {};
    }
    this.root.data.case_data.case.transicion_id = transitionId;
    this.root.data.state_id = stateId;
  }

  createHandleChange() {
    return (value, stateId = null) => {
      const isClearing = value === null || value === undefined;
      this.updateValue(value, {
        modified: true,
        resetValue: isClearing,
      });
      this.syncStateToFormData(value, stateId);
    };
  }

  /**
   * @param {Element} element
   */
  attach(element) {
    this.reactRoot?.unmount();
    super.attach(element);

    const componentType = StatesComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode)
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );

    if (!this.builderMode) {
      try {
        const wrapper =
          element.closest && element.closest('.form-group')
            ? element.closest('.form-group')
            : element.parentElement;
        const labelEl =
          wrapper &&
          (wrapper.querySelector('.formio-component-label') ||
            wrapper.querySelector('label'));
        if (labelEl) labelEl.style.display = 'none';
      } catch (e) {
        // ignore
      }
    }

    this.root.submission.data = this.root.submission.data || {};
    const handleChange = this.createHandleChange();

    this.reactRoot.render(
      createElement(States, {
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        handleChange,
        root: this.root,
        disabled: this.disabled,
        component: this.component,
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (!this.reactRoot || this.builderMode) return;
    const handleChange = this.createHandleChange();
    this.reactRoot.render(
      createElement(States, {
        onEvent: this.on.bind(this),
        offEvent: this.off.bind(this),
        handleChange,
        root: this.root,
        disabled: this.disabled,
        component: this.component,
      })
    );
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}

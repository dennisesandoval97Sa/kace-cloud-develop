import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { EventLog } from './EventLog.jsx';
import customTabEditForm from './custom.form.json';

const FormioComponent = Components.components.container;

/**
 * Resolves subcase / nested context case id. `globalRoot` on `this.root` is often set only in
 * `formReady` (after `attach`), so we also read `options.globalRoot` (passed from Schema) and walk parents.
 * @param {any} component - Form.io component instance (`this` from attach)
 * @returns {string | null}
 */
function getKaceContextCaseId(component) {
  try {
    const pick = (gr) => {
      const raw = gr?.data?.case_id;
      if (raw == null || raw === '') return null;
      return String(raw);
    };

    const direct = pick(component.options?.globalRoot);
    if (direct) return direct;

    const fromRootGlobal = pick(component.root?.globalRoot);
    if (fromRootGlobal) return fromRootGlobal;

    const fromRootOptions = pick(component.root?.options?.globalRoot);
    if (fromRootOptions) return fromRootOptions;

    let node = component.parent;
    while (node) {
      const gr = node.globalRoot ?? node.options?.globalRoot;
      const id = pick(gr);
      if (id) return id;
      node = node.parent;
    }
  } catch (err) {
    console.error('[EventLogComponent] getKaceContextCaseId', err);
  }
  return null;
}

export default class EventLogComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'kace_event_log';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: EventLogComponent.COMPONENT_TYPE,
      key: EventLogComponent.COMPONENT_TYPE,
      label: 'Historial de eventos',
      fieldPath: '',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Event Log',
      icon: 'history', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: EventLogComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = EventLogComponent.COMPONENT_TYPE;
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

    const componentType = EventLogComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode)
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );

    const contextCaseId = getKaceContextCaseId(this);

    this.reactRoot.render(
      createElement(EventLog, {
        component: this.component,
        fieldPath: this.component.fieldPath,
        componentPath: this.path,
        updateValue: this.updateValue.bind(this),
        disabled: Boolean(this.component.disabled),
        contextCaseId,
        eventLogInstanceId: String(this.component.id ?? ''),
      })
    );

    // globalRoot may be assigned on the webform only after formReady; refresh once on next tick.
    if (contextCaseId == null) {
      queueMicrotask(() => {
        if (!this.reactRoot || this.builderMode) return;
        const lateId = getKaceContextCaseId(this);
        if (lateId == null) return;
        this.reactRoot.render(
          createElement(EventLog, {
            component: this.component,
            fieldPath: this.component.fieldPath,
            componentPath: this.path,
            updateValue: this.updateValue.bind(this),
            disabled: Boolean(this.component.disabled),
            contextCaseId: lateId,
            eventLogInstanceId: String(this.component.id ?? ''),
          })
        );
      });
    }
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (!this.reactRoot || this.builderMode) return;
    const contextCaseId = getKaceContextCaseId(this);

    this.reactRoot.render(
      createElement(EventLog, {
        component: this.component,
        fieldPath: this.component.fieldPath,
        componentPath: this.path,
        updateValue: this.updateValue.bind(this),
        disabled: Boolean(this.component.disabled),
        contextCaseId,
        eventLogInstanceId: String(this.component.id ?? ''),
      })
    );
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}

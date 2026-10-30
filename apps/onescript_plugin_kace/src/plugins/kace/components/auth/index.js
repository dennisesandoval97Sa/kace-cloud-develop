import { Components } from '@formio/react';
import { createElement, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { Auth } from './Auth.jsx';
import { CaseTabRefreshFloating } from '#plugins/kace/components/case-tab-refresh/CaseTabRefreshFloating.jsx';
import { storeService } from '#plugins/kace/services/storeService.js';
import { applyCaseEditLock } from './applyCaseEditLock.js';
import { scheduleCaseEditLockReapply } from './scheduleCaseEditLockReapply.js';

const FormioComponent = Components.components.container;

export default class AuthComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'auth';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: AuthComponent.COMPONENT_TYPE,
      key: AuthComponent.COMPONENT_TYPE,
      label: 'Auth',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Auth',
      icon: 'lock', // https://fontawesome.com/v4/icons/
      preview: false, // This is how you can hide/show the preview column in editForm modal
      schema: AuthComponent.schema(),
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
    const componentType = AuthComponent.COMPONENT_TYPE;

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

    const componentType = AuthComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode)
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );

    this.root.submission.data = this.root.submission.data || {};
    const handleChange = ({ case_data = {}, kace_config = null }) => {
      if (!this.root.submission.data.case_data) {
        this.root.submission.data.case_data = {};
      }

      if (!this.root.submission.data.kace_config) {
        this.root.submission.data.kace_config = {};
      }

      if (kace_config) {
        this.root.submission.data.kace_config = kace_config;
      }

      this.root.submission.data.case_data = case_data;
    };

    this.reactRoot.render(
      createElement(
        Fragment,
        null,
        createElement(Auth, {
          component: this.component,
          emitEvent: this.emit.bind(this),
          handleChange,
          form: this.root,
          disabled: this.disabled,
        }),
        createElement(CaseTabRefreshFloating, {
          onEvent: this.on.bind(this),
          offEvent: this.off.bind(this),
          disabled: this.disabled,
        })
      )
    );

    this.reapplyCaseEditLockIfNeeded();

    if (!this._caseEditLockRedrawBound && this.root?.on) {
      this._caseEditLockRedrawBound = true;
      this._caseEditLockRedrawHandler = () => {
        if (storeService.get('cases.case_edit_locked')) {
          applyCaseEditLock(this.root, { locked: true });
        }
      };
      this.root.on('redraw', this._caseEditLockRedrawHandler);
    }
  }

  reapplyCaseEditLockIfNeeded() {
    if (storeService.get('cases.case_edit_locked')) {
      applyCaseEditLock(this.root, { locked: true });
      scheduleCaseEditLockReapply(this.root);
    }
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (this.reactRoot && !this.builderMode) {
      this.reactRoot.render(
        createElement(
          Fragment,
          null,
          createElement(Auth, {
            component: this.component,
            emitEvent: this.emit.bind(this),
            form: this.root,
            handleChange: ({ case_data = {}, kace_config = null }) => {
              if (!this.root.submission.data.case_data) {
                this.root.submission.data.case_data = {};
              }
              if (!this.root.submission.data.kace_config) {
                this.root.submission.data.kace_config = {};
              }
              if (kace_config) {
                this.root.submission.data.kace_config = kace_config;
              }
              this.root.submission.data.case_data = case_data;
            },
            disabled: this.disabled,
          }),
          createElement(CaseTabRefreshFloating, {
            onEvent: this.on.bind(this),
            offEvent: this.off.bind(this),
            disabled: this.disabled,
          })
        )
      );
      this.reapplyCaseEditLockIfNeeded();
    }
  }

  detach() {
    if (this._caseEditLockRedrawHandler && this.root?.off) {
      this.root.off('redraw', this._caseEditLockRedrawHandler);
    }
    this._caseEditLockRedrawBound = false;
    this._caseEditLockRedrawHandler = null;
    this.reactRoot?.unmount();
    super.detach();
  }
}

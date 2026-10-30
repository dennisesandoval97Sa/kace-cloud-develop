import '#plugins/kace/shared/styles/kace-floating-controls.css';
import { Components } from '@formio/react';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { CustomSubmit } from './CustomSubmit.jsx';
import kace_data from '#plugins/kace/shared/KaceData.js';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import customTabEditForm from './custom.form.json';
import { createFormComponentRedrawFns } from '#plugins/kace/utils/createFormComponentRedrawFns.js';
import { ensureCanEditCase } from '#plugins/kace/shared/ensureCanEditCase.js';

const FormioComponent = Components.components.button;

export default class CustomSubmitComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'kace_custom_submit_natura';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: CustomSubmitComponent.COMPONENT_TYPE,
      key: CustomSubmitComponent.COMPONENT_TYPE,
      label: 'Guardar',
      size: 'md',
      theme: 'info',
      showValidations: false,
      disableOnInvalid: false,
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace CustomSubmit Natura',
      icon: 'life-ring', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: CustomSubmitComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return FormioComponent.editForm([customTabEditForm], ...extend);
  };

  render() {
    this._enableButtonObserver();
    if (this.component?.floatingButton && !this.builderMode) {
      this._applyFloatingStyle();
    }
    return super.render(
      `<div id="${CustomSubmitComponent.COMPONENT_TYPE}-${this.component.id}"></div>`
    );
  }

  _enableButtonObserver() {
    const button = this.element?.querySelector('button');
    if (!button) return;

    const observer = new MutationObserver(() => {
      button.disabled = false;
      button.classList.remove('disabled');
    });

    observer.observe(button, {
      attributes: true,
      attributeFilter: ['disabled', 'class'],
    });
    this._buttonObserver = observer;
  }

  _applyFloatingStyle() {
    if (!this.component?.floatingButton) return;

    const interval = setInterval(() => {
      try {
        const button = this.element?.querySelector('button');
        if (!button) return;
        clearInterval(interval);
        button.classList.add('kace-floating-submit');
      } catch (e) {
        try {
          clearInterval(interval);
        } catch (clearErr) {
          // ignore
        }
      }
    }, 100);
  }

  _emitSubmitButtonState(value) {
    this.emit?.('submitButtonState', value);
    this.root?.emit?.('submitButtonState', value);
    if (this.root?.globalRoot && this.root.globalRoot !== this.root) {
      this.root.globalRoot.emit?.('submitButtonState', value);
    }
  }

  async beforeSubmit() {
    this._emitSubmitButtonState(true);

    const kaceEngine = KaceEngine();
    if (await ensureCanEditCase(kaceEngine)) {
      this._emitSubmitButtonState(false);
      return false;
    }

    this.emit('submitButtonClicked', 'submit button was clicked');
    this.root?.emit?.('submitButtonClicked', 'submit button was clicked');

    const buttonEl = this.element.querySelector('button');

    if (buttonEl) {
      const spinner = buttonEl.querySelector('.fa-refresh, .fa-spin');
      if (spinner) spinner.remove();
    }

    let originalClasses = buttonEl?.className || '';
    if (this.component?.floatingButton) {
      if (!originalClasses.includes('kace-floating-submit')) {
        originalClasses = `${originalClasses} kace-floating-submit`.trim();
      }
      buttonEl?.classList.add('kace-floating-submit');
    }
    const originalLabel = buttonEl?.innerHTML || '';

    if (this.root) {
      if (!this.root.submission) {
        this.root.submission = { data: this.root.data ?? this.data ?? {} };
      } else if (!this.root.submission.data) {
        this.root.submission.data = this.root.data ?? this.data ?? {};
      }
    }

    const isValid = this.root?.checkValidity
      ? await this.root.checkValidity(this.root?.data ?? this.data ?? {}, true)
      : true;

    if (!isValid) {
      this._emitSubmitButtonState(false);
      this.error = {
        level: 'warning',
        message:
          'Por favor, corrige los errores de validación antes de guardar.',
        component: this.component,
      };
      this.emit?.('submitButtonValidationFailed', 'formio validation failed');
      if (buttonEl) {
        buttonEl.className = originalClasses;
        buttonEl.innerHTML = originalLabel;
      }
      return false;
    }

    try {
      const validationRoot = this.root?.globalRoot || this.root;
      const nestedPromise = validationRoot?._nestedFormValidationPromise;
      if (nestedPromise) {
        const result = await nestedPromise;
        if (result && result.valid === false) {
          this._emitSubmitButtonState(false);
          if (buttonEl) {
            buttonEl.className = originalClasses;
            buttonEl.innerHTML = originalLabel;
          }
          return false;
        }
        const confirmId = validationRoot
          ? (validationRoot._submitConfirmId =
              (validationRoot._submitConfirmId || 0) + 1)
          : Date.now();
        this.emit?.('submitButtonConfirmed', { confirmId });
        this.root?.emit?.('submitButtonConfirmed', { confirmId });
        if (result && result.valid === false) {
          this._emitSubmitButtonState(false);
          if (buttonEl) {
            buttonEl.className = originalClasses;
            buttonEl.innerHTML = originalLabel;
          }
          return false;
        }
      }
    } catch (e) {
      this._emitSubmitButtonState(false);
      if (buttonEl) {
        buttonEl.className = originalClasses;
        buttonEl.innerHTML = originalLabel;
      }
      return false;
    }

    this.emit?.('submitButtonConfirmed', 'submit button confirmed');
    this.root?.emit?.('submitButtonConfirmed', 'submit button confirmed');

    buttonEl.classList.add('disabled');

    try {
      let payload = this.data?.kaceSchema ?? null;

      if (!payload) {
        if (this.data?.case_data) payload = this.data.case_data;
        else if (this.data?.aux_cases) payload = this.data.aux_cases;
        else payload = this.data ?? {};
      }

      const kaceEngine = KaceEngine();

      if (this.component.customSubmitCode) {
        const fileService = kaceEngine.getService('file');
        const storeService = kaceEngine.getService('storeService');
        const attachments =
          storeService?.get?.('cases.attachments') ??
          kace_data?.attachments ??
          [];
        const caseService = kaceEngine.getService('cases');
        const caseTimerRaw =
          typeof window !== 'undefined'
            ? localStorage.getItem('caseTimer')
            : null;
        const timerId = caseTimerRaw ? JSON.parse(caseTimerRaw)?.timerId : null;
        const formRoot = this.root?.globalRoot ?? this.root;
        const { redrawComponent, redrawComponents, redrawAll, getComponent } =
          createFormComponentRedrawFns(formRoot);
        evaluateKace(this.component.customSubmitCode, {
          data: this.data,
          row: this.data,
          component: this.component,
          instance: this,
          root: formRoot,
          singleton: kace_data ?? {},
          kaceEngine,
          apiService: kaceEngine.getService('apiService'),
          uploadAttachments: fileService.uploadPendingAttachments,
          attachments: Array.isArray(attachments) ? attachments : [],
          getComponent,
          redrawComponent,
          redrawComponents,
          redrawAll,
          saveTimer: async () => {
            if (timerId) {
              try {
                await caseService.finishTimerAfterSubmit(
                  timerId,
                  'Formulario Guardado'
                );
                localStorage.removeItem('caseTimer');
              } catch (error) {
                throw new Error('Error actualizando el temporizador');
              }
            }
          },
        });
      }
      try {
        const storeService = kaceEngine.getService('storeService');
        if (storeService?.clear) {
          storeService.clear();
        }
      } catch (e) {}

      this.error = null;
      if (buttonEl) {
        const floatCls = this.component?.floatingButton
          ? ' kace-floating-submit'
          : '';
        buttonEl.className = `btn btn-success formio-button-submit${floatCls}`;
        buttonEl.innerHTML = `<i class="fa fa-check"></i> Guardado`;
      }
    } catch (error) {
      this._emitSubmitButtonState(false);
      if (buttonEl) {
        const floatCls = this.component?.floatingButton
          ? ' kace-floating-submit'
          : '';
        buttonEl.className = `btn btn-danger formio-button-submit${floatCls}`;
        buttonEl.innerHTML = `<i class="fa fa-times"></i> Error`;
      }
      this.error = {
        level: 'info',
        message: error.message,
        component: this.component,
      };
    }

    this._emitSubmitButtonState(false);

    setTimeout(() => {
      if (buttonEl) {
        buttonEl.className = originalClasses;
        buttonEl.innerHTML = originalLabel;
      }
    }, 3000);

    return super.beforeSubmit();
  }

  /**
   * @param {Element} element
   */
  attach(element) {
    this.reactRoot?.unmount();
    super.attach(element);

    const componentType = CustomSubmitComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode) {
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, {
          label: this.component.label,
        })
      );
    }

    this.reactRoot.render(
      createElement(CustomSubmit, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        rootForm: this.root,
      })
    );

    requestAnimationFrame(() => {
      this._applyFloatingStyle();
      this._enableButtonObserver();
    });
  }

  detach() {
    this._buttonObserver?.disconnect();

    this.reactRoot?.unmount();
    super.detach();
  }
}

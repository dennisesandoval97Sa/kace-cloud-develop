import '#plugins/kace/shared/styles/kace-floating-controls.css';
import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { Submit } from './Submit.jsx';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import Swal from 'sweetalert2';
import { postMessageToParent } from '#plugins/kace/shared/postMessageToParent.util.js';
import customTabEditForm from './custom.form.json';
import { showStaleWarnings } from '../../shared/showStaleWarnings';
import { showWebformErrors } from '#plugins/kace/shared/FocusFormComponent.js';
import { ensureCanEditCase } from '#plugins/kace/shared/ensureCanEditCase.js';

const FormioComponent = Components.components.button;

// Use this custom error instead of the default generic error

export default class SubmitComponent extends FormioComponent {
  /**
   * It is not really necessary but it simplifies and centralizes
   * the configuration of the component type for Formio
   *
   * @todo change this random value an then remove this _todo_
   */
  static get COMPONENT_TYPE() {
    return 'kace_submit';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: SubmitComponent.COMPONENT_TYPE,
      key: SubmitComponent.COMPONENT_TYPE,
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
      title: 'Kace Submit',
      icon: 'floppy-o', // https://fontawesome.com/v4/icons/
      preview: true, // This is how you can hide/show the preview column in editForm modal
      schema: SubmitComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return FormioComponent.editForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = SubmitComponent.COMPONENT_TYPE;
    this._enableButtonObserver();
    this._addGlobalSpinnerCSS();

    if (this.component?.floatingButton && !this.builderMode) {
      this._applyFloatingStyle();
    }

    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
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

  _addGlobalSpinnerCSS() {
    const styleId = 'kace-submit-global-spinner-hide';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Ocultar spinners en botones de Formio */
        button.formio-button-submit .fa-spin,
        button.formio-button-submit .fa-refresh,
        button.formio-button-submit .fa-spinner,
        button.formio-button-submit .fa-circle-o-notch,
        button.formio-button-submit i.fa-spin,
        button.formio-button-submit i.fa-refresh,
        button.formio-button-submit i.fa-spinner,
        button.formio-button-submit span.fa-spin,
        button.formio-button-submit [class*="spinner"],
        button.formio-button-submit [class*="loading"],
        button.formio-button-submit [class*="spin"],
        button[type="submit"] .fa-spin,
        button[type="submit"] .fa-refresh,
        button[type="submit"] .fa-spinner,
        button[type="submit"] .fa-circle-o-notch,
        button[type="submit"] i.fa-spin,
        button[type="submit"] i.fa-refresh,
        button[type="submit"] i.fa-spinner,
        button[type="submit"] [class*="spinner"],
        button[type="submit"] [class*="loading"],
        button[type="submit"] [class*="spin"],
        /* Selectores más genéricos */
        button i.fa-spin,
        button i.fa-refresh,
        button i.fa-spinner,
        button i.fa-circle-o-notch,
        button span.fa-spin,
        button span.fa-refresh,
        button [class*="fa-spin"],
        button [class*="fa-refresh"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          font-size: 0 !important;
          line-height: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  _isTimerPaused() {
    try {
      if (typeof window === 'undefined') return false;
      const raw = localStorage.getItem('caseTimer');
      if (!raw || raw === 'null') return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.paused);
    } catch (e) {
      return false;
    }
  }

  _handleTimerSaveRequested = (payload) => {
    if (payload?.handled) return;
    const buttonEl = this.element?.querySelector('button');
    if (!buttonEl || buttonEl.disabled) return;
    payload.handled = true;
    buttonEl.click();
  };

  _bindTimerSaveHandler() {
    const target = this.root?.globalRoot || this.root;
    if (!target?.on) return;
    this._timerSaveTarget = target;
    target.on('timerSaveRequested', this._handleTimerSaveRequested);
  }

  _unbindTimerSaveHandler() {
    if (!this._timerSaveTarget) return;
    this._timerSaveTarget.off?.(
      'timerSaveRequested',
      this._handleTimerSaveRequested
    );
    this._timerSaveTarget.removeListener?.(
      'timerSaveRequested',
      this._handleTimerSaveRequested
    );
    this._timerSaveTarget = null;
  }

  async beforeSubmit() {
    this._emitSubmitButtonState(true);

    const kaceEngine = KaceEngine();
    if (await ensureCanEditCase(kaceEngine)) {
      this._emitSubmitButtonState(false);
      this._restoreButtonState();
      return false;
    }

    if (this._isTimerPaused()) {
      this._emitSubmitButtonState(false);
      this._restoreButtonState();
      await Swal.fire({
        icon: 'warning',
        title: 'Timer en pausa',
        text: 'No puedes guardar mientras el temporizador está en pausa. Reanúdalo para continuar.',
        confirmButtonText: 'Entendido',
      });
      return false;
    }

    const waitForAuxCases = () =>
      new Promise((resolve) => {
        let resolved = false;
        const handler = (payload) => {
          if (resolved) return;
          resolved = true;
          try {
            this.off && this.off('auxCasesDataChanged', handler);
          } catch (e) {}
          resolve(payload);
        };

        try {
          this.on && this.on('auxCasesDataChanged', handler);
        } catch (e) {}

        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          try {
            this.off && this.off('auxCasesDataChanged', handler);
          } catch (e) {}
          resolve(null);
        }, 1000);
      });

    if (this.root) {
      if (!this.root.submission) {
        this.root.submission = { data: this.root.data ?? this.data ?? {} };
      } else if (!this.root.submission.data) {
        this.root.submission.data = this.root.data ?? this.data ?? {};
      }

      if (!this.root.submission?.data?.case_data?.clasificacion_id) {
        const kaceEngine = KaceEngine();
        const storeService = kaceEngine.getService('storeService');
        if (!this.root.submission.data.case_data) {
          this.root.submission.data.case_data = {};
        }
        this.root.submission.data.case_data.case.clasificacion_id =
          storeService.get('classifications.current_classification');
      }
    }

    const isValid = this.root?.checkValidity
      ? await this.root.checkValidity(this.root?.data ?? this.data ?? {}, true)
      : true;
    if (!isValid) {
      this._emitSubmitButtonState(false);
      this.emit?.('submitButtonValidationFailed', 'formio validation failed');
      this._restoreButtonState();

      // `NestedComponent.errors` (which feeds `root.showErrors`) concatenates
      // `this.error` from every child, including this button. Keep it unset
      // while the native list paints so the button's own warning doesn't
      // show up as a fake field error, then set it for other listeners.
      // `this.error = null` must happen even when a previous attempt already
      // set it — `Component.setCustomValidity('')` only clears `this.error`
      // when `external` matches, so an unmarked warning from a prior Guardar
      // would otherwise survive into this list.
      this.error = null;
      showWebformErrors(this.root, null);
      this.error = {
        level: 'warning',
        message:
          'Por favor, corrige los errores de validación antes de guardar.',
        component: this.component,
        external: true,
      };

      if (!this.root?.alert) {
        await Swal.fire({
          icon: 'warning',
          title: 'Validación fallida',
          text: 'Por favor, corrige los errores de validación antes de guardar.',
          confirmButtonText: 'Entendido',
        });
      }
      return false;
    }

    this._restoreButtonState();

    this._startButtonProtection();

    Swal.fire({
      title: 'Guardando...',
      text: 'Por favor espera mientras se procesa la información',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const auxPromise = waitForAuxCases();
    this.emit('submitButtonClicked', 'submit button was clicked');
    this.root?.emit?.('submitButtonClicked', 'submit button was clicked');
    await auxPromise;

    try {
      const validationRoot = this.root?.globalRoot || this.root;
      // Schema paints its own error list via `showWebformErrors` on the
      // *nested* webform instance (not `validationRoot`) when validation
      // fails, and records that instance on `_nestedFormAlertInstance` at
      // that point — so this must be read AFTER awaiting the validation
      // promise below, never before, or it always sees the pre-validation
      // (unset) value. A disconnected `.alert` node (component already torn
      // down) doesn't count as painted either.
      const isNestedAlertPainted = () => {
        const alertNode = validationRoot?._nestedFormAlertInstance?.alert;
        return Boolean(
          alertNode &&
          (typeof alertNode.isConnected !== 'boolean' || alertNode.isConnected)
        );
      };
      const nestedPromise = validationRoot?._nestedFormValidationPromise;
      if (nestedPromise) {
        const result = await nestedPromise;
        if (result && result.valid === false) {
          this._emitSubmitButtonState(false);
          this._stopButtonProtection();
          this._restoreButtonState();
          // Dismiss the non-dismissible "Guardando..." Swal — if the nested
          // list already painted we return below without opening a
          // replacement Swal, so this is the only thing that closes it.
          Swal.close();
          if (!isNestedAlertPainted()) {
            await Swal.fire({
              icon: 'error',
              title: 'Error de validación',
              text: 'La validación del formulario falló',
              confirmButtonText: 'Entendido',
            });
          }
          return false;
        }
      } else {
        const result = validationRoot?._nestedFormValidationResult;
        if (result && result.valid === false) {
          this._emitSubmitButtonState(false);
          this._stopButtonProtection();
          this._restoreButtonState();
          Swal.close();
          if (!isNestedAlertPainted()) {
            await Swal.fire({
              icon: 'error',
              title: 'Error de validación',
              text: 'La validación del formulario falló',
              confirmButtonText: 'Entendido',
            });
          }
          return false;
        }
      }
    } catch (e) {
      this._emitSubmitButtonState(false);
      this._stopButtonProtection();
      this._restoreButtonState();
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error durante la validación',
        confirmButtonText: 'Entendido',
      });
      return false;
    }

    const validationRoot = this.root?.globalRoot || this.root;
    const confirmId = validationRoot
      ? (validationRoot._submitConfirmId =
          (validationRoot._submitConfirmId || 0) + 1)
      : Date.now();
    this.emit?.('submitButtonConfirmed', { confirmId });
    this.root?.emit?.('submitButtonConfirmed', { confirmId });

    try {
      const kaceEngine = KaceEngine();
      const caseService = kaceEngine.getService('cases');
      const storeService = kaceEngine.getService('storeService');
      const storeCaseData = storeService?.get?.('cases.case_data') ?? {};

      const submissionData =
        this.root?.submission?.data ?? this.root?.data ?? {};
      const case_data = submissionData?.case_data?.case ?? {};
      const auxCaseData =
        submissionData?.aux_cases?.data ??
        submissionData?.case_data?.aux_cases?.data ??
        {};
      const description =
        submissionData?.kaceDescription ?? submissionData?.kace_description;
      const flow_id = submissionData?.flujo_id || null;
      const transition_id = case_data?.case?.transicion_id;
      const case_id =
        case_data?.id ??
        storeCaseData?.case_id ??
        storeCaseData?.generated_case_id;

      storeService.set('oneScript.validation_schema', {});

      const isUpdate = Boolean(storeService.get('cases.case_id'));
      const caseTimerRaw =
        typeof window !== 'undefined'
          ? localStorage.getItem('caseTimer')
          : null;
      const timerId = caseTimerRaw ? JSON.parse(caseTimerRaw)?.timerId : null;

      await caseService.validateCaseFields(
        case_data,
        auxCaseData,
        description,
        isUpdate
      );
      const { staleCodes = [], caseId: createdCaseId } =
        await caseService.createCase({
          caseData: this.root.submission.data.case_data ?? {},
          description,
        });
      this.emit('submitButtonSubmitted', { transition_id, flow_id });
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

      this.error = null;

      await Swal.fire({
        icon: 'success',
        title: '¡Guardado exitosamente!',
        text: 'El caso se ha guardado correctamente',
        confirmButtonText: 'Entendido',
        timer: 3000,
        timerProgressBar: true,
      });

      await showStaleWarnings(staleCodes);

      postMessageToParent({
        route: `/agent/update/${createdCaseId ?? case_id}?action=edit`,
      });
    } catch (error) {
      console.error('Error submitting case', error);

      this._emitSubmitButtonState(false);
      this._stopButtonProtection();

      await Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: error.message || 'Ocurrió un error al intentar guardar el caso',
        confirmButtonText: 'Entendido',
      });

      this.error = {
        level: 'info',
        message: error.message,
        component: this.component,
      };
    }

    this._emitSubmitButtonState(false);
    this._stopButtonProtection();
    this._restoreButtonState();

    const result = super.beforeSubmit();

    this._restoreButtonState();

    setTimeout(() => {
      this._restoreButtonState();
    }, 0);

    setTimeout(() => {
      this._restoreButtonState();
    }, 10);

    let restoreCount = 0;
    const postSubmitRestore = setInterval(() => {
      this._restoreButtonState();
      restoreCount++;
      if (restoreCount > 100) {
        clearInterval(postSubmitRestore);
      }
    }, 10);

    return result;
  }

  _startButtonProtection() {
    if (this._buttonRestoreInterval) {
      clearInterval(this._buttonRestoreInterval);
    }

    this._restoreButtonState();

    this._buttonRestoreInterval = setInterval(() => {
      this._restoreButtonState();
    }, 5);

    const protectFrame = () => {
      if (this._buttonRestoreInterval) {
        this._restoreButtonState();
        requestAnimationFrame(protectFrame);
      }
    };
    requestAnimationFrame(protectFrame);
  }

  _stopButtonProtection() {
    if (this._buttonRestoreInterval) {
      clearInterval(this._buttonRestoreInterval);
      this._buttonRestoreInterval = null;
    }
  }

  _restoreButtonState() {
    const buttonEl = this.element?.querySelector('button');
    if (!buttonEl || !this._buttonOriginalState) return;

    const spinnerSelectors = [
      '.fa-spin',
      '.fa-refresh',
      '.fa-spinner',
      '.fa-circle-o-notch',
      '.fa-check',
      '.fa-times',
      '.fa-spinner-o',
      '.fa-cog',
      '[class*="spinner"]',
      '[class*="loading"]',
      '[class*="spin"]',
      'i.fa-spin',
      'i.fa-refresh',
      'i.fa-spinner',
      'span.fa-spin',
      '[class*="fa-spin"]',
      '[class*="fa-refresh"]',
    ];
    spinnerSelectors.forEach((selector) => {
      try {
        const elements = buttonEl.querySelectorAll(selector);
        elements.forEach((el) => {
          const classes = el.className || '';
          if (
            classes.includes('fa-spin') ||
            classes.includes('fa-refresh') ||
            classes.includes('fa-spinner') ||
            classes.includes('spinner') ||
            classes.includes('loading')
          ) {
            el.remove();
          }
        });
      } catch (e) {
        // Ignorar errores de selector
      }
    });

    const allElements = buttonEl.querySelectorAll('i, span');
    allElements.forEach((el) => {
      const classes = el.className || '';
      if (
        classes.includes('fa-spin') ||
        classes.includes('fa-refresh') ||
        classes.includes('fa-spinner') ||
        classes.includes('fa-circle-o-notch') ||
        (classes.includes('fa') && classes.includes('spin'))
      ) {
        el.remove();
      }
    });

    const forbiddenClasses = [
      'btn-success',
      'btn-danger',
      'btn-warning',
      'btn-loading',
      'loading',
      'spinning',
    ];
    const baseClasses = this._buttonOriginalState.className
      .split(' ')
      .filter((cls) => cls && !forbiddenClasses.includes(cls))
      .join(' ');

    if (buttonEl.className !== baseClasses) {
      buttonEl.className = baseClasses;
    }

    const currentHTML = buttonEl.innerHTML.trim().replace(/\s+/g, ' ');
    const originalHTML = this._buttonOriginalState.innerHTML
      .trim()
      .replace(/\s+/g, ' ');

    if (
      currentHTML !== originalHTML ||
      currentHTML.includes('fa-spin') ||
      currentHTML.includes('fa-refresh') ||
      currentHTML.includes('fa-spinner') ||
      currentHTML.includes('fa-circle-o-notch')
    ) {
      buttonEl.innerHTML = this._buttonOriginalState.innerHTML;
    }
  }

  /**
   * @param {Element} element
   */
  attach(element) {
    this.reactRoot?.unmount();
    super.attach(element);

    const componentType = SubmitComponent.COMPONENT_TYPE;
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
      createElement(Submit, {
        component: this.component,
        updateValue: this.updateValue.bind(this),
        rootForm: this.root,
      })
    );

    this._protectButton();

    this._interceptFormioMethods();
    this._bindTimerSaveHandler();
  }

  _interceptFormioMethods() {
    if (this.setLoading && typeof this.setLoading === 'function') {
      const originalSetLoading = this.setLoading.bind(this);
      this.setLoading = (loading) => {
        const result = originalSetLoading(loading);
        setTimeout(() => {
          this._restoreButtonState();
        }, 0);
        return result;
      };
    }

    if (this.redraw && typeof this.redraw === 'function') {
      const originalRedraw = this.redraw.bind(this);
      this.redraw = () => {
        const result = originalRedraw();
        setTimeout(() => {
          this._restoreButtonState();
        }, 0);
        return result;
      };
    }
  }

  _protectButton() {
    this._setupButtonProtection();

    setTimeout(() => {
      this._setupButtonProtection();
    }, 0);

    setTimeout(() => {
      this._setupButtonProtection();
    }, 50);

    setTimeout(() => {
      this._setupButtonProtection();
    }, 100);
  }

  _setupButtonProtection() {
    const buttonEl = this.element?.querySelector('button');
    if (!buttonEl) return;

    const componentType = SubmitComponent.COMPONENT_TYPE;
    const currentButtonEl = buttonEl;

    if (
      !this._buttonOriginalState ||
      currentButtonEl.innerHTML !== this._buttonOriginalState.innerHTML
    ) {
      const existingSpinners = currentButtonEl.querySelectorAll(
        '.fa-spin, .fa-refresh, .fa-spinner, .fa-circle-o-notch'
      );
      existingSpinners.forEach((spinner) => spinner.remove());

      if (this.component?.floatingButton) {
        currentButtonEl.classList.add('kace-floating-submit');
      }

      const originalState = {
        className: currentButtonEl.className,
        innerHTML: currentButtonEl.innerHTML,
        textContent:
          currentButtonEl.textContent || currentButtonEl.innerText || '',
      };
      this._buttonOriginalState = originalState;
    }

    const styleId = `kace-submit-protection-${this.component.id}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        #${componentType}-${this.component.id} button .fa-spin,
        #${componentType}-${this.component.id} button .fa-refresh,
        #${componentType}-${this.component.id} button .fa-spinner,
        #${componentType}-${this.component.id} button .fa-circle-o-notch,
        #${componentType}-${this.component.id} button [class*="spinner"],
        #${componentType}-${this.component.id} button [class*="loading"],
        #${componentType}-${this.component.id} button [class*="spin"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }

    const restoreButton = () => {
      const btn = this.element?.querySelector('button');
      if (!btn || !this._buttonOriginalState) return;

      const spinners = btn.querySelectorAll(
        '.fa-spin, .fa-refresh, .fa-spinner, .fa-circle-o-notch'
      );
      spinners.forEach((spinner) => spinner.remove());

      const baseClasses = this._buttonOriginalState.className
        .split(' ')
        .filter(
          (cls) => !['btn-success', 'btn-danger', 'btn-warning'].includes(cls)
        )
        .join(' ');
      btn.className = baseClasses;

      if (btn.innerHTML !== this._buttonOriginalState.innerHTML) {
        btn.innerHTML = this._buttonOriginalState.innerHTML;
      }
    };

    const originalAppendChild =
      currentButtonEl.appendChild.bind(currentButtonEl);
    currentButtonEl.appendChild = (node) => {
      if (node && node.nodeType === 1) {
        // Element node
        const classList = node.classList || [];
        const isSpinner = Array.from(classList).some(
          (cls) =>
            cls.includes('spinner') ||
            cls.includes('spin') ||
            cls.includes('loading') ||
            cls === 'fa-spin' ||
            cls === 'fa-refresh' ||
            cls === 'fa-spinner' ||
            cls === 'fa-circle-o-notch'
        );
        if (isSpinner) {
          return node;
        }
      }
      return originalAppendChild(node);
    };

    const originalInsertBefore =
      currentButtonEl.insertBefore.bind(currentButtonEl);
    currentButtonEl.insertBefore = (newNode, referenceNode) => {
      if (newNode && newNode.nodeType === 1) {
        const classList = newNode.classList || [];
        const isSpinner = Array.from(classList).some(
          (cls) =>
            cls.includes('spinner') ||
            cls.includes('spin') ||
            cls.includes('loading') ||
            cls === 'fa-spin' ||
            cls === 'fa-refresh' ||
            cls === 'fa-spinner' ||
            cls === 'fa-circle-o-notch'
        );
        if (isSpinner) {
          return newNode;
        }
      }
      return originalInsertBefore(newNode, referenceNode);
    };

    let innerHTMLDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'innerHTML'
    );
    if (!innerHTMLDescriptor) {
      innerHTMLDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'innerHTML'
      );
    }

    if (innerHTMLDescriptor && innerHTMLDescriptor.set) {
      const originalSetInnerHTML = innerHTMLDescriptor.set;
      const componentInstance = this;
      Object.defineProperty(currentButtonEl, 'innerHTML', {
        set: function (value) {
          if (
            typeof value === 'string' &&
            (value.includes('fa-spin') ||
              value.includes('fa-refresh') ||
              value.includes('fa-spinner') ||
              value.includes('fa-circle-o-notch') ||
              value.includes('spinner') ||
              value.includes('loading'))
          ) {
            if (componentInstance._buttonOriginalState) {
              originalSetInnerHTML.call(
                this,
                componentInstance._buttonOriginalState.innerHTML
              );
              return;
            }
          }
          originalSetInnerHTML.call(this, value);
        },
        get: innerHTMLDescriptor.get,
        configurable: true,
      });
    }

    let classNameDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'className'
    );
    if (!classNameDescriptor) {
      classNameDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'className'
      );
    }

    if (classNameDescriptor && classNameDescriptor.set) {
      const originalSetClassName = classNameDescriptor.set;
      const componentInstance = this;
      const forbiddenClasses = [
        'btn-success',
        'btn-danger',
        'btn-warning',
        'btn-loading',
        'loading',
        'spinning',
      ];

      Object.defineProperty(currentButtonEl, 'className', {
        set: function (value) {
          if (typeof value === 'string') {
            const classes = value
              .split(' ')
              .filter((cls) => cls && !forbiddenClasses.includes(cls));
            const filteredValue = classes.join(' ');

            if (
              value !== filteredValue &&
              componentInstance._buttonOriginalState
            ) {
              const baseClasses =
                componentInstance._buttonOriginalState.className
                  .split(' ')
                  .filter((cls) => cls && !forbiddenClasses.includes(cls))
                  .join(' ');
              originalSetClassName.call(this, baseClasses);
              return;
            }
          }
          originalSetClassName.call(this, value);
        },
        get: classNameDescriptor.get,
        configurable: true,
      });
    }

    const observer = new MutationObserver(() => {
      restoreButton();
    });

    observer.observe(currentButtonEl, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
      characterData: true,
    });

    if (!this._buttonObserver) {
      this._buttonObserver = observer;
    }

    restoreButton();
  }

  detach() {
    this._unbindTimerSaveHandler();
    if (this._buttonObserver) {
      this._buttonObserver.disconnect();
      this._buttonObserver = null;
    }
    if (this._buttonRestoreInterval) {
      clearInterval(this._buttonRestoreInterval);
      this._buttonRestoreInterval = null;
    }
    this.reactRoot?.unmount();
    super.detach();
  }
}

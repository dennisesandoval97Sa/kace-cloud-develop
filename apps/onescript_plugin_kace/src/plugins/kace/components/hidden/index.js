import { Components } from '@formio/react';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import postAuthScriptTab from './post-auth-script.form.json';
import onMountScriptTab from './on-mount-script.form.json';
import {
  HIDDEN_COMPONENT_KEYS,
  HIDDEN_POST_AUTH_SCRIPT_ERROR_EVENT,
  HIDDEN_ON_MOUNT_SCRIPT_ERROR_EVENT,
} from './lib/hidden.constants.js';

const FormioComponent = Components.components.container;

export default class HiddenComponent extends FormioComponent {
  static get COMPONENT_TYPE() {
    return 'kace_hidden';
  }

  static schema(...extend) {
    return FormioComponent.schema({
      type: HiddenComponent.COMPONENT_TYPE,
      key: HiddenComponent.COMPONENT_TYPE,
      label: 'Kace Hidden',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Hidden',
      icon: 'superpowers',
      preview: true,
      schema: HiddenComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm(
      [postAuthScriptTab, onMountScriptTab],
      ...extend
    );
  };

  /**
   * @param {unknown} kaceData
   */
  _runPostAuthKaceScript(kaceData) {
    if (!this._postAuthScriptListenerActive) return;
    try {
      const code =
        this.component?.[HIDDEN_COMPONENT_KEYS.POST_AUTH_KACE_SCRIPT];
      if (typeof code !== 'string' || !code.trim()) return;

      const kaceEngine = KaceEngine();
      if (!kaceEngine) return;

      const data = this.root?.submission?.data ?? {};
      evaluateKace(code.trim(), {
        kaceEngine,
        apiService: kaceEngine.getService?.('apiService'),
        kaceData,
        data,
        row: data,
        component: this.component,
        instance: this,
      });
    } catch (err) {
      try {
        console.warn('[Kace Hidden] Post-Auth script:', err?.message ?? err);
        this.emit(
          HIDDEN_POST_AUTH_SCRIPT_ERROR_EVENT,
          err?.message ?? String(err)
        );
      } catch (emitErr) {
        console.warn(
          '[Kace Hidden] Post-Auth emit error:',
          emitErr?.message ?? emitErr
        );
      }
    }
  }

  _runOnMountKaceScript() {
    try {
      const code = this.component?.[HIDDEN_COMPONENT_KEYS.ON_MOUNT_KACE_SCRIPT];
      if (typeof code !== 'string' || !code.trim()) return;

      const kaceEngine = KaceEngine();
      if (!kaceEngine) return;

      const data = this.root?.submission?.data ?? {};
      evaluateKace(code.trim(), {
        kaceEngine,
        apiService: kaceEngine.getService?.('apiService'),
        data,
        row: data,
        component: this.component,
        instance: this,
      });
    } catch (err) {
      try {
        console.warn('[Kace Hidden] On-Mount script:', err?.message ?? err);
        this.emit(
          HIDDEN_ON_MOUNT_SCRIPT_ERROR_EVENT,
          err?.message ?? String(err)
        );
      } catch (emitErr) {
        console.warn(
          '[Kace Hidden] On-Mount emit error:',
          emitErr?.message ?? emitErr
        );
      }
    }
  }

  render() {
    const componentType = HiddenComponent.COMPONENT_TYPE;
    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
    );
  }

  attach(element) {
    this.reactRoot?.unmount();
    super.attach(element);

    const componentType = HiddenComponent.COMPONENT_TYPE;
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

    this._postAuthScriptListenerActive = true;
    this._boundPostAuthScript = this._runPostAuthKaceScript.bind(this);
    this.on('kaceAuthData', this._boundPostAuthScript);

    this.reactRoot.render(null);

    if (!this._onMountScriptExecuted) {
      this._onMountScriptExecuted = true;
      this._runOnMountKaceScript();
    }
  }

  detach() {
    this._onMountScriptExecuted = false;
    this._postAuthScriptListenerActive = false;
    if (typeof this.off === 'function' && this._boundPostAuthScript) {
      try {
        this.off('kaceAuthData', this._boundPostAuthScript);
      } catch (err) {
        console.warn('[Kace Hidden] detach listener:', err?.message ?? err);
      }
    }
    this._boundPostAuthScript = null;
    this.reactRoot?.unmount();
    super.detach();
  }
}

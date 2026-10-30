import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import customTabEditForm from './custom.form.json';
import { ClassificationLevels } from './ClassificationLevels.jsx';
import { readLevelValuesFromData } from './classificationLevelsUtils.js';

const FormioComponent = Components.components.base;

const LEVEL_KEYS = ['nivel1', 'nivel2', 'nivel3', 'nivel4', 'nivel5'];

export default class ClassificationLevelsComponent extends FormioComponent {
  static get COMPONENT_TYPE() {
    return 'classification_levels';
  }

  static schema(...extend) {
    return FormioComponent.schema({
      type: ClassificationLevelsComponent.COMPONENT_TYPE,
      key: ClassificationLevelsComponent.COMPONENT_TYPE,
      label: 'Reclasificación del caso',
      hideLabel: true,
      input: false,
      tableView: false,
      classificationsInitCode: '',
      flattenOutput: true,
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Classification Levels',
      icon: 'sitemap',
      preview: true,
      schema: ClassificationLevelsComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = ClassificationLevelsComponent.COMPONENT_TYPE;
    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
    );
  }

  attach(element) {
    this.reactRoot?.unmount();
    super.attach(element);

    const componentType = ClassificationLevelsComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode) {
      const previewLabel =
        typeof this.component.label === 'string' && this.component.label.trim()
          ? this.component.label.trim()
          : 'Reclasificación del caso';
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, {
          label: previewLabel,
        })
      );
    }

    this.root.submission.data = this.root.submission.data || {};
    this.root.data = this.root.data || {};
    this.migrateNestedComponentKey();
    this.removeComponentKeyFromData();
    this.syncFlattenedLevelsFromRoot();

    this.handleLevelsChange = (levels) => {
      if (!levels || typeof levels !== 'object') return;

      const flatten = this.component.flattenOutput !== false;
      if (!flatten) {
        this.dataValue = this.pickLevelValues(levels);
        this.triggerChange();
        return;
      }

      this.applyFlattenedLevels(levels, { forceNotify: true });
    };

    this._levelsDataSignature = '';
    this._lastEmittedSignature = '';
    this.boundOnEvent = this.on.bind(this);
    this.boundOffEvent = this.off.bind(this);

    this.syncReactFromFormData = () => {
      const snapshot = LEVEL_KEYS.map((key) =>
        String(
          this.root?.data?.[key] ?? this.root?.submission?.data?.[key] ?? ''
        )
      ).join('\u0001');
      if (snapshot === this._levelsDataSignature) return;
      if (snapshot === this._lastEmittedSignature) {
        this._levelsDataSignature = snapshot;
        return;
      }
      this._levelsDataSignature = snapshot;
      this.removeComponentKeyFromData();
      this.renderReactComponent();
    };
    this.on('redraw', this.syncReactFromFormData);

    this.renderReactComponent();
    queueMicrotask(() => this.syncReactFromFormData());
  }

  pickLevelValues(levels) {
    const out = {};
    for (const key of LEVEL_KEYS) {
      const val = levels[key];
      if (val !== undefined && val !== null && val !== '') {
        out[key] = val;
      }
    }
    return out;
  }

  buildMergedFormData() {
    const rootData = this.root?.data ?? {};
    const submissionData = this.root?.submission?.data ?? {};
    const componentKey = this.component?.key;
    return {
      ...submissionData,
      ...rootData,
      ...readLevelValuesFromData(
        { ...submissionData, ...rootData, ...(this.data ?? {}) },
        componentKey
      ),
    };
  }

  removeComponentKeyFromData() {
    const componentKey = this.component?.key;
    if (!componentKey) return false;

    let removed = false;
    for (const scope of [
      this.data,
      this.root?.data,
      this.root?.submission?.data,
    ]) {
      if (
        scope &&
        typeof scope === 'object' &&
        Object.prototype.hasOwnProperty.call(scope, componentKey)
      ) {
        delete scope[componentKey];
        removed = true;
      }
    }

    if (
      this.data &&
      typeof this.data === 'object' &&
      this.data !== this.root?.data &&
      this.data !== this.root?.submission?.data
    ) {
      for (const key of LEVEL_KEYS) {
        if (Object.prototype.hasOwnProperty.call(this.data, key)) {
          delete this.data[key];
          removed = true;
        }
      }
    }

    if (this.dataValue != null) {
      this.dataValue = null;
      removed = true;
    }

    return removed;
  }

  migrateNestedComponentKey() {
    const componentKey = this.component?.key;
    if (!componentKey) return;

    const nested =
      this.root?.data?.[componentKey] ??
      this.root?.submission?.data?.[componentKey];
    if (!nested || typeof nested !== 'object') return;

    for (const key of LEVEL_KEYS) {
      const val = nested[key];
      if (val === undefined || val === null || val === '') continue;
      this.root.data[key] = val;
      this.root.submission.data[key] = val;
    }
  }

  syncFlattenedLevelsFromRoot() {
    if (this.component.flattenOutput === false) return;

    const levels = readLevelValuesFromData(
      {
        ...(this.root?.submission?.data ?? {}),
        ...(this.root?.data ?? {}),
      },
      this.component?.key
    );
    if (!Object.keys(levels).length) {
      this.removeComponentKeyFromData();
      return;
    }

    this.applyFlattenedLevels(levels, { forceNotify: false });
  }

  applyFlattenedLevels(levels, options = {}) {
    const { forceNotify = false } = options;
    if (!this.root.data) this.root.data = {};
    if (!this.root.submission) this.root.submission = {};
    if (!this.root.submission.data) this.root.submission.data = {};

    let changed = false;
    for (const key of LEVEL_KEYS) {
      const val = levels?.[key];
      const current = this.root.data[key];
      if (val !== undefined && val !== null && val !== '') {
        if (String(current ?? '') !== String(val)) changed = true;
        this.root.data[key] = val;
        this.root.submission.data[key] = val;
      } else if (current !== undefined && current !== null && current !== '') {
        changed = true;
        delete this.root.data[key];
        delete this.root.submission.data[key];
      }
    }

    const removedNested = this.removeComponentKeyFromData();

    if (!changed && !removedNested && !forceNotify) return;

    this._lastEmittedSignature = LEVEL_KEYS.map((key) =>
      String(levels?.[key] ?? '')
    ).join('\u0001');
    this._levelsDataSignature = this._lastEmittedSignature;
    this.triggerChange({ modified: true });
  }

  getValue() {
    if (this.component.flattenOutput !== false) {
      return null;
    }
    return super.getValue();
  }

  setValue(value, flags = {}) {
    if (this.component.flattenOutput !== false) {
      this.migrateNestedComponentKey();
      this.removeComponentKeyFromData();
      this.syncFlattenedLevelsFromRoot();
      this.renderReactComponent();
      return false;
    }
    return super.setValue(value, flags);
  }

  updateValue(value, flags = {}) {
    if (this.component.flattenOutput !== false) {
      this.removeComponentKeyFromData();
      return super.updateValue(null, flags);
    }
    return super.updateValue(value, flags);
  }

  renderReactComponent() {
    if (!this.reactRoot || this.builderMode) return;
    this.reactRoot.render(
      createElement(ClassificationLevels, {
        onLevelsChange: this.handleLevelsChange,
        root: this.root,
        disabled: this.disabled,
        component: this.component,
        data: this.buildMergedFormData(),
        onEvent: this.boundOnEvent,
        offEvent: this.boundOffEvent,
      })
    );
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    this.renderReactComponent();
  }

  detach() {
    this.off?.('redraw', this.syncReactFromFormData);
    this.reactRoot?.unmount();
    super.detach();
  }
}

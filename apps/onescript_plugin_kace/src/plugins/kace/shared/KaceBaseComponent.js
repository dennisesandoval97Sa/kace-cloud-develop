import { Components } from '@formio/react';
import { evaluateDependency } from '#plugins/kace/hooks/useSchema.utils.js';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { findSchemaForKey } from '#plugins/kace/shared/FindSchemaForKey.js';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import customOnChangeEditForm from '#plugins/kace/shared/customOnChange.editForm.json';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { SCHEMA_KEY_CUSTOM_ON_CHANGE } from '#plugins/kace/shared/kace-events.constants.js';
import {
  dependencyPathFromFormioPath,
  isPlainObject,
  resolveDependencyParentValue,
} from '#plugins/kace/shared/resolveDependencyParentValue.js';
import { storeService } from '../services/storeService';
import {
  getJoiMessages,
  getDefaultFieldLabel,
  getInvalidFallback,
  localizePatternName,
} from '#util/esValidationMessages.js';

/**
 * Clase base para componentes Kace con validación Joi
 * @abstract
 */
export default class KaceBaseComponent {
  /**
   * Crea una clase de componente Kace extendiendo un componente Formio base
   *
   * @param {Object} config - Configuración del componente
   * @param {string} config.componentType - Tipo del componente (ej: 'kace_text_field')
   * @param {string} config.formioBaseComponent - Nombre del componente base de Formio (ej: 'textfield')
   * @param {Object} config.builderInfo - Información para el builder
   * @param {string} config.builderInfo.title - Título del componente
   * @param {string} config.builderInfo.icon - Icono FontAwesome v4
   * @param {boolean} [config.builderInfo.preview=true] - Mostrar preview en editForm
   * @returns {Class} Clase del componente extendido
   */
  static create(config) {
    const { componentType, formioBaseComponent, builderInfo } = config;

    const FormioComponent = Components.components[formioBaseComponent];

    class KaceComponent extends FormioComponent {
      /**
       * @param {...import('formiojs').ExtendedComponentSchema} extend
       */
      static schema(...extend) {
        return FormioComponent.schema({
          type: componentType,
          key: null,
          label: null,
          [SCHEMA_KEY_CUSTOM_ON_CHANGE]: null,
          ...extend,
        });
      }

      static get builderInfo() {
        return {
          title: builderInfo.title,
          icon: builderInfo.icon,
          preview:
            builderInfo.preview !== undefined ? builderInfo.preview : true,
          schema: KaceComponent.schema(),
        };
      }

      static editForm = (...extend) => {
        return FormioComponent.editForm([customOnChangeEditForm], ...extend);
      };

      checkValidity(data, dirty, rowData) {
        if (this.builderMode) return true;

        if (
          typeof this.visible === 'function'
            ? !this.visible()
            : this.visible === false
        ) {
          if (this.error) this.error = null;
          return true;
        }

        const value = this.dataValue;
        const compKey = this.component && this.component.key;
        let kace_schema = this.component.kaceValidation;
        const validationSchema = storeService.get(
          'oneScript.validation_schema'
        );
        if (!kace_schema && validationSchema) {
          kace_schema = findSchemaForKey(validationSchema, compKey);
        }

        if (kace_schema) {
          const validate = Object.assign({}, this.component.validate || {});

          if (kace_schema.dependency && kace_schema.dependsOn) {
            const rootData =
              this.rootValue ||
              this.root?.submission?.data ||
              this.data ||
              data ||
              {};
            const path = dependencyPathFromFormioPath(this.path, compKey);
            const localData = isPlainObject(this.data) ? this.data : undefined;
            const parentValue = resolveDependencyParentValue(
              rootData,
              path,
              kace_schema.dependsOn,
              localData
            );

            if (!evaluateDependency(kace_schema, parentValue)) {
              if (this.error) this.error = null;
              return true;
            }
          }

          validate.required = !!kace_schema.required;

          this.component.validate = validate;

          if (kace_schema.required === true) {
            const isEmpty =
              value === null ||
              value === undefined ||
              value === '' ||
              (Array.isArray(value) && value.length === 0);

            if (isEmpty) {
              this.setCustomValidity(
                this.t(this.errorMessage('required'), {
                  field: this.component.label || getDefaultFieldLabel(),
                }),
                dirty
              );
              this.pristine = false;
              return false;
            }
          }

          const schemaForValidation = { ...kace_schema };
          delete schemaForValidation.dependency;
          delete schemaForValidation.dependsOn;
          delete schemaForValidation.dependencyValue;
          delete schemaForValidation.dependencyValueValidation;

          const fieldLabel =
            this.component.label ||
            kace_schema.ui?.label?.trim() ||
            getDefaultFieldLabel();
          const schemaBuilderResult =
            SchemaBuilder.build(schemaForValidation).label(fieldLabel);
          const { error } = schemaBuilderResult.validate(value, {
            context: { isUpdate: false },
            messages: getJoiMessages(),
          });

          if (error) {
            if (error.details[0].type === 'number.base' && value === '') {
              return true;
            }
            this.setCustomValidity(
              localizePatternName(error.details[0].message),
              dirty
            );
            this.pristine = false;
            return false;
          }
        }

        if (this.error) {
          this.error = null;
        }

        return super.checkValidity(data, dirty, rowData);
      }

      setCustomValidity(message, dirty) {
        if (this.builderMode) return;

        const isRawValidationPayload = (msg) => {
          if (typeof msg === 'string') {
            return /"message"/.test(msg) && /"context"/.test(msg);
          }
          if (Array.isArray(msg)) {
            return msg.some(
              (item) => item?.message != null && item?.context != null
            );
          }
          if (msg && typeof msg === 'object') {
            return msg.message != null && msg.context != null;
          }
          return false;
        };
        if (isRawValidationPayload(message)) {
          if (this.error) this.error = null;
          return;
        }

        let safeMessage = message;
        if (typeof safeMessage !== 'string') {
          if (safeMessage && typeof safeMessage.message === 'string') {
            safeMessage = safeMessage.message;
          } else if (safeMessage && typeof safeMessage.key === 'string') {
            safeMessage = safeMessage.key;
          } else if (
            safeMessage &&
            Array.isArray(safeMessage.errors) &&
            safeMessage.errors[0]?.message
          ) {
            safeMessage = safeMessage.errors[0].message;
          } else if (
            safeMessage &&
            Array.isArray(safeMessage.details) &&
            safeMessage.details[0]?.message
          ) {
            safeMessage = safeMessage.details[0].message;
          } else {
            try {
              safeMessage = JSON.stringify(safeMessage);
            } catch (e) {
              safeMessage = String(safeMessage);
            }
          }
        }
        if (
          safeMessage === '[object Object]' ||
          safeMessage === '{}' ||
          safeMessage === 'null' ||
          safeMessage === 'undefined'
        ) {
          safeMessage = getInvalidFallback();
        }
        super.setCustomValidity(safeMessage, dirty);
        if (safeMessage && this.error) {
          // Augment (never replace) the error object `super.setCustomValidity`
          // just built, so its `external` flag survives: Form.io only clears
          // `this.error` on `setCustomValidity('')` when
          // `this.error.external === !!external`, and a hand-made object without
          // `external` would leave a stale error (phantom banner warning) after
          // the field becomes valid again.
          //
          // What we add: the full component path, both at the top level and on
          // the `messages[]` entry. Form.io's error-list renderer
          // (`Alert.createErrorMessage`) sets each item's `data-component-key`
          // from `err.messages[index].path || err.component.key`, and only an
          // item that got a key navigates to its field on click. A field nested
          // in an EditGrid needs the full path
          // (`puntos_de_venta[0].rva_tipo_cuenta_bancaria`) — a string
          // `setCustomValidity` otherwise records no path at all, so the item
          // renders with `cursor: pointer` but is inert. `hasLabel: true` keeps
          // the renderer from prefixing the label again (it is already baked
          // into `safeMessage`).
          const path = this.path || this.component.key;
          const baseMessage = this.error.messages?.[0] || {
            message: safeMessage,
            level: 'error',
          };
          this.error = {
            ...this.error,
            path,
            messages: [
              {
                ...baseMessage,
                message: safeMessage,
                level: 'error',
                path,
                context: {
                  ...(baseMessage.context || {}),
                  key: this.component.key,
                  label: this.component.label,
                  path,
                  hasLabel: true,
                },
              },
            ],
          };
        }
      }

      updateValue(value, flags = {}) {
        const changed = super.updateValue(value, flags);

        if (changed && !this.builderMode && flags.modified) {
          this.pristine = false;
          this.checkValidity(null, true);

          const customOnChangeCode =
            this.component[SCHEMA_KEY_CUSTOM_ON_CHANGE];
          if (
            customOnChangeCode &&
            typeof customOnChangeCode === 'string' &&
            customOnChangeCode.trim()
          ) {
            try {
              const data = this.root?.data ?? this.data ?? {};
              let kaceEngine = null;
              try {
                kaceEngine = KaceEngine();
              } catch (_) {
                // KaceEngine not available in this context
              }
              const emitTarget = this.root?.globalRoot ?? this.root;
              evaluateKace(customOnChangeCode, {
                data,
                row: data,
                component: this.component,
                instance: this,
                emit:
                  typeof emitTarget?.emit === 'function'
                    ? emitTarget.emit.bind(emitTarget)
                    : undefined,
                root: this.root,
                ...(kaceEngine && {
                  kaceEngine,
                  apiService: kaceEngine.getService?.('apiService'),
                }),
                value: this.dataValue,
              });
            } catch (err) {
              if (typeof console !== 'undefined' && console.error) {
                console.error('[KaceBaseComponent] customOnChange error:', err);
              }
            }
          }
        }

        return changed;
      }

      render(...args) {
        return super.render(...args);
      }

      /**
       * @param {Element} element
       */
      attach(element) {
        this.reactRoot?.unmount();
        return super.attach(element);
      }

      detach() {
        this.reactRoot?.unmount();
        return super.detach();
      }
    }

    return KaceComponent;
  }
}

import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { VOData } from './VOData.js';
import { InvalidArgumentError } from '../../shared/index.js';
import { DeepMergeAuxiliariesData } from '../../shared/domain/services/DeepMergeAuxiliariesData';

export class Auxiliary extends AggregateRoot {
    /* type {VOData} */
    #data;
    #shouldOverrideArray = false;

    /**
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.entity_id
     * @param {Object} params.data
     * @param {Object} params.data_structure
     * @param {Date} params.created_at
     * @param {string} params.created_by
     * @param {Date} params.updated_at
     * @param {string} params.updated_by
     * @param {Date|null} params.deleted_at
     * @param {string|null} params.deleted_by
     */
    constructor({ id, data, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by }) {
        if (Object.keys(data).length === 0) {
            throw new InvalidArgumentError('The data object is empty');
        }

        super(id);
        this.#data = new VOData('data', data);
        this.created_at = created_at;
        this.created_by = created_by;
        this.updated_at = updated_at;
        this.updated_by = updated_by;
        this.deleted_at = deleted_at;
        this.deleted_by = deleted_by;
    }

    static create(dto) {
        return new Auxiliary(dto);
    }

    update(dto, shouldOverrideArray = false) {
        this.#shouldOverrideArray = shouldOverrideArray;
        if (dto.data) {
            this.data = dto.data
        };
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
    }

    /**
     * Gets the value of the `data` attribute.
     * @returns {VOData} The `VOData` instance representing the `data`.
     */
    get data() {
        return this.#data;
    }

    /**
     * Sets the value of the `data` attribute.
     * @param {Object} value - The new value for the `data`.
     */
    set data(value) {
        if (Object.keys(value).length === 0) {
            throw new InvalidArgumentError('The data object is empty');
        }
        value = DeepMergeAuxiliariesData.execute(this.#data.value, value, this.#shouldOverrideArray);
        this.#data = new VOData('data', value);
        this.changedAttributes.data = JSON.stringify(value);
    }

    /**
     * Verifica si un campo específico es requerido.
     * @param {string} fieldName - El nombre del campo a verificar.
     * @returns {boolean} true si el campo es requerido, false en caso contrario.
     */
    isFieldRequired(fieldName) {
        const fieldConfig = this.getFieldConfig(fieldName);
        return fieldConfig ? fieldConfig.required === true : false;
    }

    /**
     * Obtiene el tipo de componente de entrada para un campo específico.
     * @param {string} fieldName - El nombre del campo.
     * @returns {Object|null} La configuración del componente o null si no existe.
     */
    getFieldComponent(fieldName) {
        const fieldConfig = this.getFieldConfig(fieldName);
        return fieldConfig ? fieldConfig.component || fieldConfig.inputComponent : null;
    }
}

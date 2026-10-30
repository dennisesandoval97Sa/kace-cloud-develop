import { AggregateRoot, ValueObjectString } from '../../shared';
import { ValueObjectCaseDescription } from './ValueObjectCaseDescription';

export class CaseDescription extends AggregateRoot {
    /**
     * @type {ValueObjectString}
     * is initialized in the constructor
     */
    #descripcion;

    constructor({ id, descripcion, created_by, created_at, updated_by, updated_at }) {
        super(id);
        this.#descripcion = new ValueObjectCaseDescription('descripcion', descripcion ?? 'default');
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        if (this.#descripcion.value !== value) {
            this.#descripcion = new ValueObjectCaseDescription('descripcion', value);
            this.changedAttributes.descripcion = value;
        }
    }

    /**
     * Creates a new CaseDescription object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the CaseDescription object.
     * @returns {CaseDescription} A new instance of the CaseDescription class.
     */
    static create(dto) {
        return new CaseDescription(dto);
    }
}

import { AggregateRoot, ValueObjectBoolean, ValueObjectUuid } from '../../shared';
import { ValueObjectLiteralName } from './ValueObjectLiteralName';

export class Literal extends AggregateRoot {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #tipo_literal;
    /** @type {ValueObjectLiteralName} is initialized in the constructor */
    #nombre;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */

    constructor({
        id,
        tipo_literal,
        nombre,
        is_active,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#tipo_literal = new ValueObjectUuid('tipo_literal', tipo_literal, true);
        this.#nombre = new ValueObjectLiteralName(nombre ?? 'default');
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get tipo_literal() {
        return this.#tipo_literal;
    }

    set tipo_literal(value) {
        if (this.#tipo_literal.value !== value) {
            this.#tipo_literal = new ValueObjectUuid('tipo_literal', value);
            this.changedAttributes.tipo_literal = value;
        }
    }

    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        if (this.#nombre.value !== value) {
            this.#nombre = new ValueObjectLiteralName(value);
            this.changedAttributes.nombre = value;
        }
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectBoolean('is_active', value);
            this.changedAttributes.is_active = value;
        }
    }

    getchangedAttributes() {
        return this.changedAttributes;
    }

    /**
     * Creates a new Literal object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the Literal object.
     * @returns {Literal} A new instance of the Literal class.
     */
    static create(dto) {
        return new Literal(dto);
    }
}

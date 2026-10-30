import { AggregateRoot, ValueObjectBoolean, ValueObjectDescription } from '../../shared';
import { ValueObjectGroupLists } from './ValueObjectGroupLists';

export class GroupList extends AggregateRoot {
    /** @type {ValueObjectDescription} */
    #descripcion; // is initialized in the constructor
    /** @type {ValueObjectGroupLists} is initialized in the constructor */
    #lista_grupos;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;

    constructor(dto) {
        super(dto.id);
        this.#descripcion = new ValueObjectDescription('descripcion', dto.descripcion ?? 'default');
        this.#lista_grupos = new ValueObjectGroupLists('lista_grupos', dto.lista_grupos);
        this.#is_active = new ValueObjectBoolean('is_active', dto.is_active ?? false);
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        value = new ValueObjectDescription('descripcion', value);
        this.#descripcion = value;
        this.changedAttributes.descripcion = this.#descripcion.value;
    }

    get lista_grupos() {
        return this.#lista_grupos;
    }

    set lista_grupos(value) {
        value = new ValueObjectGroupLists('lista_grupos', value);
        this.#lista_grupos = value;
        this.changedAttributes.lista_grupos = this.#lista_grupos.value;
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        value = new ValueObjectBoolean('is_active', value);
        this.#is_active = value;
        this.changedAttributes.status = this.#is_active.value;
    }

    /**
     * Creates a new GroupList object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the GroupList object.
     * @returns {GroupList} A new instance of the GroupList class.
     */
    static create(dto) {
        return new GroupList(dto);
    }
}

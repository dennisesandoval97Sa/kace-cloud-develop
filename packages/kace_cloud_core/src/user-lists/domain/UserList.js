import { AggregateRoot, ValueObjectBoolean, ValueObjectDescription, ValueObjectUuid } from '../../shared';
import { ValueObjectUserLists } from './ValueObjectUserLists';

export class UserList extends AggregateRoot {
    /** @type {ValueObjectDescription} */
    #descripcion; // is initialized in the constructor
    /** @type {ValueObjectUserLists} is initialized in the constructor */
    #lista_usuarios;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #group_id;

    constructor(dto) {
        super(dto.id);
        this.#descripcion = new ValueObjectDescription('descripcion', dto.descripcion ?? 'default');
        this.#lista_usuarios = new ValueObjectUserLists('lista_usuarios', dto.lista_usuarios);
        this.#is_active = new ValueObjectBoolean('is_active', dto.is_active ?? false);
        this.#group_id = new ValueObjectUuid('group_id', dto.group_id ?? null, true);
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

    get lista_usuarios() {
        return this.#lista_usuarios;
    }

    set lista_usuarios(value) {
        value = new ValueObjectUserLists('lista_usuarios', value);
        this.#lista_usuarios = value;
        this.changedAttributes.lista_usuarios = JSON.stringify(this.#lista_usuarios.value);
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        value = new ValueObjectBoolean('is_active', value);
        this.#is_active = value;
        this.changedAttributes.is_active = this.#is_active.value;
    }

    get group_id() {
        return this.#group_id;
    }

    set group_id(value) {
        value = new ValueObjectUuid('group_id', value, true);
        this.#group_id = value;
        this.changedAttributes.group_id = this.#group_id.value;
    }
    /**
     * Creates a new UserList object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the UserList object.
     * @returns {UserList} A new instance of the UserList class.
     */
    static create(dto) {
        return new UserList(dto);
    }
}

import { ValueObjectString, ValueObjectUuid } from '../../shared';

export class UserGroupRelationship {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #usuario_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #grupo_id;
    /** @type {ValueObjectString} is initialized in the constructor */
    #nombre;
    /** @type {ValueObjectString} is initialized in the constructor */
    #nombre_usuario;
    /**
     * Creates an instance of UserGroupRelationship.
     * @param {Object} dto - The parameters for creating the relationship.
     * @param {string} dto.usuario_id - The ID of the user.
     * @param {string} dto.grupo_id - The ID of the group..
     * @param {string} dto.nombre - The Name of the group..
     * @param {string} dto.nombre_usuario - The Name of the user..
     */
    constructor({ usuario_id, grupo_id, nombre, nombres }) {
        this.#usuario_id = new ValueObjectUuid('usuario_id', usuario_id);
        this.#grupo_id = new ValueObjectUuid('grupo_id', grupo_id);
        this.#nombre = new ValueObjectString('nombre', nombre, true);
        this.#nombre_usuario = new ValueObjectString('nombre_usuario', nombres, true);
    }

    get usuario_id() {
        return this.#usuario_id;
    }

    set usuario_id(value) {
        if (this.#usuario_id.value !== value) {
            this.#usuario_id = new ValueObjectUuid('usuario_id', value);
            this.changedAttributes.usuario_id = value;
        }
    }

    get grupo_id() {
        return this.#grupo_id;
    }

    set grupo_id(value) {
        if (this.#grupo_id.value !== value) {
            this.#grupo_id = new ValueObjectUuid('group_id', value);
            this.changedAttributes.grupo_id = value;
        }
    }
    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        if (this.#nombre.value !== value) {
            this.#nombre = new ValueObjectString('nombre', value, true);
            this.changedAttributes.nombre = value;
        }
    }

    get nombre_usuario() {
        return this.#nombre_usuario;
    }

    set nombre_usuario(value) {
        if (this.#nombre_usuario.value !== value) {
            this.#nombre_usuario = new ValueObjectString('nombre_usuario', value, true);
            this.changedAttributes.nombre_usuario = value;
        }
    }

    /**
     * Creates a new UserGroupRelationship object from the provided data transfer object (DTO).
     * @param {Object} dto - The data transfer object containing the properties for the UserGroupRelationship object.
     * @returns {UserGroupRelationship} A new instance of the UserGroupRelationship class.
     */
    static create(dto) {
        return new UserGroupRelationship(dto);
    }
}

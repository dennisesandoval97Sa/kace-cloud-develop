import { AggregateRoot, ValueObjectDescription, ValueObjectStatus } from '../../shared/index.js';
import { ValueObjectPermissions } from './value-object/ValueObjectPermissions.js';

export class Role extends AggregateRoot {
    /**@type {ValueObjectDescription} is initialized in the constructor*/
    #descripcion;
    /** @type {ValueObjectPermissions} is initialized in the constructor */
    #permisos;
    /** @type {ValueObjectStatus} is initialized in the constructor */
    #status;

    constructor(dto) {
        super(dto.id);
        this.#descripcion = new ValueObjectDescription('Descripción', dto.descripcion ?? 'default');
        this.#permisos = new ValueObjectPermissions(dto.permisos, true);
        this.#status = new ValueObjectStatus('status', dto.status);
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.deleted_at = dto.deleted_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_by = dto.deleted_by;
    }

    static create(dto) {
        return new Role(dto);
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        this.#descripcion = new ValueObjectDescription('Descripción', value);
        this.changedAttributes.descripcion = this.#descripcion.value;
    }

    get permisos() {
        return this.#permisos;
    }

    set permisos(value) {
        this.#permisos = new ValueObjectPermissions(value);
        this.changedAttributes.permisos = this.#permisos.value;
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        this.#status = new ValueObjectStatus('status', value);
        this.changedAttributes.status = this.#status.value;
    }
    /**
     * Gets the role's name.
     * @returns {string} The role's name.
     */
    getName() {
        return this.#descripcion.get();
    }
}

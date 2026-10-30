import { AggregateRoot, ValueObjectBoolean, ValueObjectDescription, ValueObjectUuid } from '../../shared';
import { ValueObjectPath } from './ValueObjectPath';
import { ValueObjectSize } from './ValueObjectSize';
import { ValueObjectType } from './ValueObjectType';

export class CaseAttachment extends AggregateRoot {
    /**
     * @type {ValueObjectDescription}
     * is initialized in the constructor
     */
    #case_id;
    /**
     * @type {ValueObjectDescription}
     * is initialized in the constructor
     */
    #description;
    /**
     * @type {ValueObjectSize}
     * is initialized in the constructor
     */
    #size;
    /**
     * @type {ValueObjectPath}
     * is initialized in the constructor
     */
    #path;
    /**
     * @type {ValueObjectType}
     * is initialized in the constructor
     */
    #type;
    /**
     * @type {ValueObjectBoolean}
     * is initialized in the constructor
     */
    #is_active;
    /**
     * @type {string|null}
     * is initialized in the constructor
     */
    #attachment_type;

    constructor({
        id,
        case_id,
        description,
        size,
        path,
        type,
        is_active,
        attachment_type,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#case_id = new ValueObjectUuid('case_id', case_id);
        this.#description = new ValueObjectDescription('description', description ?? 'default');
        this.#size = new ValueObjectSize('size', size ?? 1);
        this.#path = new ValueObjectPath('path', path ?? 'default');
        this.#type = new ValueObjectType('type', type, true);
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.#attachment_type = attachment_type ?? null;
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get case_id() {
        return this.#case_id;
    }

    set case_id(value) {
        if (this.#case_id.value !== value) {
            this.#case_id = new ValueObjectUuid('case_id', value);
            this.changedAttributes.case_id = value;
        }
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (this.#description.value !== value) {
            this.#description = new ValueObjectDescription('description', value);
            this.changedAttributes.description = value;
        }
    }

    get size() {
        return this.#size;
    }

    set size(value) {
        if (this.#size.value !== value) {
            this.#size = new ValueObjectSize('size', value);
            this.changedAttributes.size = value;
        }
    }

    get path() {
        return this.#path;
    }

    set path(value) {
        if (this.#path.value !== value) {
            this.#path = new ValueObjectPath('path', value);
            this.changedAttributes.path = value;
        }
    }

    get type() {
        return this.#type;
    }

    set type(value) {
        if (this.#type.value !== value) {
            this.#type = new ValueObjectType('type', value);
            this.changedAttributes.type = value;
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

    get attachment_type() {
        return this.#attachment_type;
    }

    set attachment_type(value) {
        const normalized = value ?? null;
        if (this.#attachment_type !== normalized) {
            this.#attachment_type = normalized;
            this.changedAttributes.attachment_type = normalized;
        }
    }

    /**
     * Crea una nueva instancia de CaseAttachment a partir de un objeto DTO.
     *
     * @param {Object} dto - El objeto DTO que contiene las propiedades para el objeto CaseAttachment.
     * @returns {CaseAttachment} Una nueva instancia de la clase CaseAttachment.
     */
    static create(dto) {
        return new CaseAttachment(dto);
    }
}

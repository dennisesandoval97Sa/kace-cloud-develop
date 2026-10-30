import { AggregateRoot, ValueObjectBoolean, ValueObjectString, ValueObjectUuid } from '../../shared';
import { ValueObjectPath } from './ValueObjectPath';

// `usage_type` must never be null/undefined once persisted: the search filter used to
// exclude inline images from the attachments UI (`usage_type != 'inline'`) relies on
// every "normal" row holding this literal value, since standard SQL `!=` silently
// excludes NULL rows instead of matching them.
export const TEMPLATE_ATTACHMENT_USAGE_TYPE_DEFAULT = 'attachment';
export const TEMPLATE_ATTACHMENT_USAGE_TYPE_INLINE = 'inline';

export class TemplateAttachment extends AggregateRoot {
    /** @type {ValueObjectUuid} is initialized in the constructor*/
    #template_id;
    /** @type {ValueObjectPath} is initialized in the constructor*/
    #path;
    /** @type {ValueObjectString} is initialized in the constructor*/
    #type;
    /** @type {ValueObjectBoolean} is initialized in the constructor*/
    #is_active;
    /** @type {string} is initialized in the constructor*/
    #usage_type;

    constructor({
        id,
        template_id,
        path,
        type,
        is_active,
        usage_type,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#template_id = new ValueObjectUuid('template_id', template_id);
        this.#path = new ValueObjectPath('path', path ?? 'default');
        this.#type = new ValueObjectString('type', type, true);
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.#usage_type = usage_type ?? TEMPLATE_ATTACHMENT_USAGE_TYPE_DEFAULT;
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get template_id() {
        return this.#template_id;
    }

    set template_id(value) {
        if (this.#template_id.value !== value) {
            this.#template_id = new ValueObjectUuid('template_id', value);
            this.changedAttributes.template_id = value;
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
            this.#type = new ValueObjectString('type', value);
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

    get usage_type() {
        return this.#usage_type;
    }

    set usage_type(value) {
        const normalized = value ?? TEMPLATE_ATTACHMENT_USAGE_TYPE_DEFAULT;
        if (this.#usage_type !== normalized) {
            this.#usage_type = normalized;
            this.changedAttributes.usage_type = normalized;
        }
    }

    /**
     * Crea una nueva instancia de TemplateAttachment a partir de un objeto DTO.
     *
     * @param {Object} dto - El objeto DTO que contiene las propiedades para el objeto TemplateAttachment.
     * @returns {TemplateAttachment} Una nueva instancia de la clase TemplateAttachment.
     */
    static create(dto) {
        return new TemplateAttachment(dto);
    }
}

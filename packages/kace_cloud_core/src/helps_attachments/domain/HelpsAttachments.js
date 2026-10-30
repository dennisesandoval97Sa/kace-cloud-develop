import { ValueObjectPath } from './ValueObjectPath';
import { AggregateRoot, ValueObjectUuid } from '../../shared';
import { ValueObjectType } from './ValueObjectType';

export class HelpsAttachments extends AggregateRoot {
    /** @type {ValueObjectPath} is initialized in the constructor */
    #path;
    /** @type {ValueObjectType} is initialized in the constructor */
    #tipo;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #help_id;

    constructor(dto) {
        super(dto.id);
        this.#path = new ValueObjectPath('path', dto.path ?? 'default.txt');
        this.#tipo = new ValueObjectType('tipo', dto.tipo ?? 'default');
        this.#help_id = new ValueObjectUuid('help_id', dto.help_id);
        this.created_by = dto.created_by;
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    static create(dto) {
        return new HelpsAttachments(dto);
    }

    get path() {
        return this.#path;
    }

    get tipo() {
        return this.#tipo;
    }
    get help_id() {
        return this.#help_id;
    }

    set path(value) {
        if (value !== this.#path) {
            this.#path = new ValueObjectPath('descripcion', value);
            this.changedAttributes.path = this.#path.value;
        }
    }

    set tipo(value) {
        if (value !== this.#tipo) {
            this.#tipo = new ValueObjectType('descripcion', value);
            this.changedAttributes.tipo = this.#tipo.value;
        }
    }
    set help_id(value) {
        if (value !== this.#help_id) {
            this.#help_id = new ValueObjectUuid('descripcion', value);
            this.changedAttributes.help_id = this.#help_id.value;
        }
    }
}

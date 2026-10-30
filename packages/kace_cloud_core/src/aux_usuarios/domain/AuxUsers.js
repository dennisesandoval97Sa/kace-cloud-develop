import { ValueObjectJson, ValueObjectUuid } from '../../shared';
import { AggregateRoot } from '../../shared/domain/AggregateRoot';

export class AuxUsers extends AggregateRoot {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #usuario_id;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #data;

    constructor(dto) {
        super(dto.id);
        this.#usuario_id = new ValueObjectUuid('usuario_id', dto.usuario_id);
        this.#data = new ValueObjectJson('data', dto.data ?? {});
        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    static create(dto) {
        return new AuxUsers(dto);
    }

    get usuario_id() {
        return this.#usuario_id;
    }

    set usuario_id(value) {
        this.#usuario_id = new ValueObjectUuid('usuario_id', value);
        this.changedAttributes.usuario_id = value;
    }

    get data() {
        return this.#data;
    }

    set data(value) {
        this.#data = new ValueObjectJson('data', value);
        this.changedAttributes.data = JSON.stringify(value);
    }
}

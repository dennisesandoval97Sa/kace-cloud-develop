import { ValueObjectJson, ValueObjectUuid } from '../../shared';
import { AggregateRoot } from '../../shared/domain/AggregateRoot';
import { DeepMergeAuxiliariesData } from '../../shared/domain/services/DeepMergeAuxiliariesData';

export class AuxClients extends AggregateRoot {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #cliente_id;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #data;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #relations;

    constructor(dto) {
        super(dto.id);
        this.#cliente_id = new ValueObjectUuid('cliente_id', dto.cliente_id);
        this.#data = new ValueObjectJson('data', dto.data ?? {});
        this.#relations = new ValueObjectJson('relations', dto.relations ?? {});
        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    static create(dto) {
        return new AuxClients(dto);
    }

    update(dto) {
        this.data = DeepMergeAuxiliariesData.execute(this.data.value, dto.data);
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
    }

    get cliente_id() {
        return this.#cliente_id;
    }

    get data() {
        return this.#data;
    }

    set cliente_id(value) {
        this.#cliente_id = new ValueObjectUuid('cliente_id', value);
        this.changedAttributes.cliente_id = value;
    }

    set data(value) {
        this.#data = new ValueObjectJson('data', value);
        this.changedAttributes.data = JSON.stringify(value);
    }

    get relations() {
        return this.#relations;
    }

    set relations(value) {
        this.#relations = new ValueObjectJson('relations', value);
        this.changedAttributes.relations = JSON.stringify(value);
    }
}

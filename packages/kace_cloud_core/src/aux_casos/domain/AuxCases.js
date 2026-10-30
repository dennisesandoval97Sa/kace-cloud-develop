import { ValueObjectJson, ValueObjectUuid } from '../../shared';
import { AggregateRoot } from '../../shared/domain/AggregateRoot';
import { DeepMergeAuxiliariesData } from '../../shared/domain/services/DeepMergeAuxiliariesData';
import { omitUniqueFields } from '../../shared/domain/services/omitUniqueFields.js';

export class AuxCases extends AggregateRoot {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #caso_id;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #data;
    constructor(dto) {
        super(dto.id);
        this.#caso_id = new ValueObjectUuid('caso_id', dto.caso_id);
        this.#data = new ValueObjectJson('data', dto.data ?? {});
        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    static create(dto) {
        return new AuxCases(dto);
    }

    /**
     * @param {string} id
     * @param {string} casoId - cloned case the copy belongs to.
     * @param {string} createdBy - user performing the clone.
     * @param {Object} [dataStructure] - unique fields are left out: their values cannot be shared.
     * @returns {AuxCases}
     */
    clone(id, casoId, createdBy, dataStructure = {}) {
        return new AuxCases({
            id,
            caso_id: casoId,
            data: omitUniqueFields(dataStructure, structuredClone(this.data.value)),
            created_at: new Date(),
            created_by: createdBy,
        });
    }

    /**
     *
     * @param {Object} dto
     * @param {Boolean} shouldOverride
     */
    update(dto, shouldOverride = false) {
        this.data = DeepMergeAuxiliariesData.execute(this.data.value, dto.data ?? {}, shouldOverride);
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
    }

    updateRaw(dto) {
        this.data = dto.data;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
    }

    get data() {
        return this.#data;
    }

    set data(data) {
        this.#data = new ValueObjectJson('data', data);
        this.changedAttributes.data = JSON.stringify(data);
    }

    get caso_id() {
        return this.#caso_id;
    }

    set caso_id(caso_id) {
        this.#caso_id = new ValueObjectUuid('caso_id', caso_id);
        this.changedAttributes.caso_id = caso_id;
    }
}

import { AggregateRoot } from '../AggregateRoot.js';
import { ValueObjectUuid } from '../value-object/ValueObjectUuid.js';
import ValueObjectJsonHistory from '../value-object/ValueObjectJsonHistory.js';
import { ValueObjectString } from '../value-object/ValueObjectString.js';

export class HistoryEntity extends AggregateRoot {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #entity_id;
    /** @type {ValueObjectJsonHistory} is initialized in the constructor */
    #changed_attributes;
    /** @type {ValueObjectJsonHistory} is initialized in the constructor */
    #new_attributes;
    /** @type {ValueObjectJsonHistory} is initialized in the constructor */
    #original_attributes;
    /** @type {ValueObjectString} is initialized in the constructor */
    #creator_name;

    constructor(dto) {
        super(dto.id);
        this.#entity_id = new ValueObjectUuid('entity_id', dto.entity_id);
        this.#changed_attributes = new ValueObjectJsonHistory('changed_attributes', dto.changed_attributes, true);
        this.#new_attributes = new ValueObjectJsonHistory('new_attributes', dto.new_attributes, true);
        this.#original_attributes = new ValueObjectJsonHistory('original_attributes', dto.original_attributes, true);
        this.#creator_name = new ValueObjectString('creator_name', dto.creator_name, true);
    }

    get entity_id() {
        return this.#entity_id;
    }

    set entity_id(value) {
        this.#entity_id = new ValueObjectUuid('entity_id', value);
        this.changedAttributes.entity_id = value;
    }

    get changed_attributes() {
        return this.#changed_attributes;
    }

    set changed_attributes(value) {
        this.#changed_attributes = new ValueObjectJsonHistory('changed_attributes', value, true);
        this.changedAttributes.changed_attributes = value;
    }

    get new_attributes() {
        return this.#new_attributes;
    }

    set new_attributes(value) {
        this.#new_attributes = new ValueObjectJsonHistory('new_attributes', value, true);
        this.changedAttributes.new_attributes = value;
    }

    get original_attributes() {
        return this.#original_attributes;
    }

    set original_attributes(value) {
        this.#original_attributes = new ValueObjectJsonHistory('original_attributes', value, true);
        this.changedAttributes.original_attributes = value;
    }

    static create(dto) {
        return new HistoryEntity(dto);
    }

    get creator_name() {
        return this.#creator_name;
    }

    set creator_name(value) {
        if (this.#creator_name.value !== value) {
            this.#creator_name = new ValueObjectString('creator_name', value, true);
            this.changedAttributes.creator_name = value;
        }
    }
}

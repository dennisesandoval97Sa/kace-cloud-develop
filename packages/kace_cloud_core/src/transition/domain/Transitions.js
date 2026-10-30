import {
    InvalidArgumentError,
    ValueObjectStatus,
    AggregateRoot,
    ValueObjectUuid,
    ValueObjectBoolean,
} from '../../shared';
import Creator from '../../shared/domain/aggregates/Creator.js';

export class Transitions extends AggregateRoot {
    /**@type {ValueObjectUuid} is initialized in the constructor */
    #estado_actual_id;
    /**@type {ValueObjectUuid} is initialized in the constructor */
    #siguiente_estado_id;
    /**@type {ValueObjectUuid} is initialized in the constructor */
    #flujo_id;
    /** @type {ValueObjectStatus} is initialized in the constructor */
    #status;
    /** @type {Creator || null} is initialized in the constructor */
    #creator;
    /** @type {ValueObjectUuid || null} is initialized in the constructor */
    #ans_id;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_visible;
    /** @type {ValueObjectUuid || null} is initialized in the constructor */
    #rule_id;

    constructor(dto, creator = null) {
        super(dto.id);
        this.#estado_actual_id = new ValueObjectUuid('Estado actual id', dto.estado_actual_id, true);
        this.#siguiente_estado_id = new ValueObjectUuid('Siguiente estado id', dto.siguiente_estado_id);
        this.#flujo_id = new ValueObjectUuid('Flujo id', dto.flujo_id);
        this.#status = new ValueObjectStatus('status', dto.status);
        this.#ensureCreatorIsValid(creator);
        this.#creator = creator;
        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at ?? null;
        this.updated_by = dto.updated_by ?? null;
        this.#ans_id = new ValueObjectUuid('Ans id', dto.ans_id, true);
        this.#is_visible = new ValueObjectBoolean('Is visible', dto.is_visible ?? true);
        this.#rule_id = new ValueObjectUuid('Rule id', dto.rule_id, true);
    }

    get is_visible() {
        return this.#is_visible;
    }

    set is_visible(value) {
        this.#is_visible = new ValueObjectBoolean('Is visible', value);
        this.changedAttributes.is_visible = value;
    }

    static create(dto) {
        return new Transitions(dto);
    }

    get estado_actual_id() {
        return this.#estado_actual_id;
    }

    set estado_actual_id(value) {
        this.#estado_actual_id = new ValueObjectUuid('Estado actual id', value);
        this.changedAttributes.estado_actual_id = value;
    }

    get siguiente_estado_id() {
        return this.#siguiente_estado_id;
    }

    set siguiente_estado_id(value) {
        this.#siguiente_estado_id = new ValueObjectUuid('Siguiente estado id', value);
        this.changedAttributes.siguiente_estado_id = value;
    }

    get flujo_id() {
        return this.#flujo_id;
    }

    set flujo_id(value) {
        this.#flujo_id = new ValueObjectUuid('Flujo id', value);
        this.changedAttributes.flujo_id = value;
    }

    get ans_id() {
        return this.#ans_id;
    }

    set ans_id(value) {
        this.#ans_id = new ValueObjectUuid('Ans id', value, true);
        this.changedAttributes.ans_id = value;
    }

    get rule_id() {
        return this.#rule_id;
    }

    set rule_id(value) {
        this.#rule_id = new ValueObjectUuid('Rule id', value, true);
        this.changedAttributes.rule_id = value;
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        this.#status = new ValueObjectStatus('status', value);
        this.changedAttributes.status = value;
    }

    #ensureCreatorIsValid(creator) {
        if (creator === null || creator instanceof Creator) {
            return;
        }
        throw new InvalidArgumentError('Comment: The creator must be an instance of Creator');
    }

    get creator() {
        return this.#creator;
    }

    set creator(value) {
        this.#ensureCreatorIsValid(value);
        this.#creator = value;
    }
}

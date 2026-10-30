import { AggregateRoot, ValueObjectDescription, ValueObjectJson, ValueObjectStatus } from '../../shared/index.js';

export class TransitionRule extends AggregateRoot {
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #nombre;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #conditions;
    /** @type {ValueObjectStatus} is initialized in the constructor */
    #status;

    constructor({
        id,
        nombre,
        conditions,
        status,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#nombre = new ValueObjectDescription('nombre', nombre ?? 'default');
        this.#conditions = new ValueObjectJson('conditions', conditions ?? {});
        this.#status = new ValueObjectStatus('status', status, true);

        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_at = updated_at ?? null;
        this.updated_by = updated_by ?? null;
        this.deleted_at = deleted_at ?? null;
        this.deleted_by = deleted_by ?? null;
    }

    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        if (this.#nombre.value !== value) {
            this.#nombre = new ValueObjectDescription('nombre', value);
            this.changedAttributes.nombre = value;
        }
    }

    get conditions() {
        return this.#conditions;
    }

    set conditions(value) {
        if (JSON.stringify(this.#conditions.value) !== JSON.stringify(value)) {
            this.#conditions = new ValueObjectJson('conditions', value);
            this.changedAttributes.conditions = value;
        }
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        if (this.#status.value !== value) {
            this.#status = new ValueObjectStatus('status', value, true);
            this.changedAttributes.status = value;
        }
    }

    /**
     * Creates a new instance of TransitionRule from a DTO object.
     * @param {Object} dto
     * @returns {TransitionRule}
     */
    static create(dto) {
        return new TransitionRule(dto);
    }
}

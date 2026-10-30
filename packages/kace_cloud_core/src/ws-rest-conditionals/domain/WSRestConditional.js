import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectSatisfied } from './value-objects/ValueObjectSatisfied.js';
import { ValueObjectUnsatisfied } from './value-objects/ValueObjectUnsatisfied.js';
import { ValueObjectInputPathA } from './value-objects/ValueObjectInputPathA.js';
import { ValueObjectInputPathB } from './value-objects/ValueObjectInputPathB.js';
import { ValueObjectOperator } from './value-objects/ValueObjectOperator.js';

export class WSRestConditional extends AggregateRoot {
    /** @type {ValueObjectSatisfied} is initialized in the constructor */
    #satisfied;
    /** @type {ValueObjectUnsatisfied} is initialized in the constructor */
    #unsatisfied;
    /** @type {ValueObjectInputPathA} is initialized in the constructor */
    #input_path_a;
    /** @type {ValueObjectInputPathB} is initialized in the constructor */
    #input_path_b;
    /** @type {ValueObjectOperator} is initialized in the constructor */
    #operator;

    constructor({
        id,
        satisfied,
        unsatisfied,
        operator,
        input_path_a,
        input_path_b,
        created_at,
        created_by,
    }) {
        super(id);
        this.#satisfied = new ValueObjectSatisfied(satisfied);
        this.#unsatisfied = new ValueObjectUnsatisfied(unsatisfied);
        this.#input_path_a = new ValueObjectInputPathA(input_path_a);
        this.#input_path_b = new ValueObjectInputPathB(input_path_b);
        this.#operator = new ValueObjectOperator(operator);
        this.created_by = created_by;
        this.created_at = created_at;
    }

    get satisfied() {
        return this.#satisfied;
    }

    set satisfied(value) {
        if (this.#satisfied.value !== value) {
            this.#satisfied = new ValueObjectSatisfied(value);
            this.changedAttributes.satisfied = value;
        }
    }

    get unsatisfied() {
        return this.#unsatisfied;
    }

    set unsatisfied(value) {
        if (this.#unsatisfied.value !== value) {
            this.#unsatisfied = new ValueObjectUnsatisfied(value);
            this.changedAttributes.unsatisfied = value;
        }
    }

    get operator() {
        return this.#operator;
    }

    set operator(value) {
        if (this.#operator.value !== value) {
            this.#operator = new ValueObjectOperator(value);
            this.changedAttributes.operator = value;
        }
    }

    get input_path_a() {
        return this.#input_path_a;
    }

    set input_path_a(value) {
        if (this.#input_path_a.value !== value) {
            this.#input_path_a = new ValueObjectInputPathA(value);
            this.changedAttributes.input_path_a = value;
        }
    }

    get input_path_b() {
        return this.#input_path_b;
    }

    set input_path_b(value) {
        if (this.#input_path_b.value !== value) {
            this.#input_path_b = new ValueObjectInputPathB(value);
            this.changedAttributes.input_path_b = value;
        }
    }

    /**
     * Convierte el objeto WSRestConditional a un formato JSON.
     *
     * @returns {Object} Representación JSON del objeto WSRestConditional.
     */
    toJson() {
        const json = super.toJson();

        const result = {
            ...json,
            satisfied: this.#satisfied.value,
            unsatisfied: this.#unsatisfied.value,
            input_path_a: this.#input_path_a.value,
            input_path_b: this.#input_path_b.value,
            operator: this.#operator.value,
        };

        return result;
    }

    /**
     * Creates a new WSRestConditional object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the WSRestConditional object.
     * @returns {WSRestConditional} A new instance of the WSRestConditional class.
     */
    static create(dto) {
        return new WSRestConditional(dto);
    }
}

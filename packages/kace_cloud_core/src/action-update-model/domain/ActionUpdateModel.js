import { AggregateRoot, ValueObjectDescription, ValueObjectString } from '../../shared/index.js';
import { Types } from './Types.js';
import { ValueObjectAggregate } from './value-objects/ValueObjectAggregate.js';
import { ValueObjectField } from './value-objects/ValueObjectField.js';
import { ValueObjectTypes } from './value-objects/ValueObjectTypes.js';
import { ValueObjectFormula } from './value-objects/ValueObjectFormula.js';

export class ActionUpdateModel extends AggregateRoot {
    /** @type {ValueObjectDescription} */
    #description; // is initialized in the constructor
    /** @type {ValueObjectAggregate} */
    #aggregate; // is initialized in the constructor
    /** @type {ValueObjectField} */
    #field; // is initialized in the constructor
    /** @type {ValueObjectTypes} */
    #type; // is initialized in the constructor
    /** @type {ValueObjectString} */
    #value; // is initialized in the constructor
    /** @type {ValueObjectFormula} */
    #formula; // is initialized in the constructor

    constructor({
        id,
        description,
        aggregate,
        field,
        type,
        value,
        formula,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#description = new ValueObjectDescription('description', description ?? 'default');
        this.#aggregate = new ValueObjectAggregate('aggregate', aggregate);
        this.#field = new ValueObjectField('field', field ?? 'default');
        this.#type = new ValueObjectTypes('type', type);
        this.#value = new ValueObjectString('value', value, true);
        this.#formula = new ValueObjectFormula('formula', formula, true);
        this.created_at = created_at;
        this.created_by = created_by;
        this.updated_at = updated_at;
        this.updated_by = updated_by;
        this.deleted_at = deleted_at;
        this.deleted_by = deleted_by;
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

    get aggregate() {
        return this.#aggregate;
    }

    set aggregate(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#aggregate.value !== value) {
            this.#aggregate = new ValueObjectAggregate('aggregate', value);
            this.changedAttributes.aggregate = value;
        }
    }

    get field() {
        return this.#field;
    }

    set field(value) {
        if (this.#field.value !== value) {
            this.#field = new ValueObjectField('field', value);
            this.changedAttributes.field = value;
        }
    }

    get type() {
        return this.#type;
    }

    set type(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#type.value !== value) {
            this.#type = new ValueObjectTypes('type', value);
            this.changedAttributes.type = value;
        }
    }

    get value() {
        return this.#value;
    }

    set value(value) {
        if (this.#value.value !== value) {
            this.#value = new ValueObjectString('value', value, true);
            this.changedAttributes.value = value;
        }
    }

    get formula() {
        return this.#formula;
    }

    set formula(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#formula.value !== value) {
            this.#formula = new ValueObjectFormula('formula', value, true);
            this.changedAttributes.formula = value;
        }
    }

    static create(dto) {
        return new ActionUpdateModel(dto);
    }

    isFormulaType() {
        return this.#type.value === Types.FORMULA.value;
    }

    isNumberType() {
        return this.#type.value === Types.NUMERO.value;
    }
}

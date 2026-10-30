import { ValueObjectString } from '../domain/value-object/ValueObjectString';

export class RelationshipCondition {
    /** @type {String} is initialized in the constructor*/
    #column;
    /** @type {String} is initialized in the constructor*/
    #refColumn;
    constructor(column, refColumn) {
        this.#column = new ValueObjectString('column', column);
        this.#refColumn = new ValueObjectString('refColumn', refColumn);
    }

    static fromPrimitives({ column, refColumn }) {
        return new RelationshipCondition(column, refColumn);
    }

    toPrimitives() {
        return {
            column: this.#column,
            refColumn: this.#refColumn,
        };
    }
}

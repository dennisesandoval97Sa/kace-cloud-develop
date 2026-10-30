import { ValueObjectString } from '../domain/value-object/ValueObjectString';
import { InvalidArgumentError } from '../errors/InvalidArgumentError';
import { RelationshipCondition } from './RelationshipCondition';
import { RelationshipType } from './RelationshipType';

export class Relationship {
    /** @type {String} is initialized in the constructor*/
    #table;
    /** @type {Object} is initialized in the constructor*/
    #condition;
    /** @type {String} is initialized in the constructor*/
    #type;
    constructor(relationship) {
        this.#ensureRelationArgumentsAreValid(relationship);

        this.#table = new ValueObjectString('table', relationship.table);
        this.#condition = RelationshipCondition.fromPrimitives(relationship.condition);
        this.#type = new RelationshipType(relationship.type);
    }

    static fromPrimitives(relationship) {
        return new Relationship(relationship);
    }

    toPrimitives() {
        return {
            table: this.#table,
            condition: this.#condition.toPrimitives(),
            type: this.#type,
        };
    }

    #ensureRelationArgumentsAreValid(relationship) {
        if (relationship.length === 0) return;

        const validRelationshipsArguments = ['table', 'condition', 'type'];
        const validConditionsArguments = ['column', 'refColumn'];
        Object.keys(relationship).forEach((argument) => {
            if (!validRelationshipsArguments.includes(argument)) {
                throw new InvalidArgumentError(`Invalid relationship argument ${argument}`);
            }
        });

        Object.keys(relationship.condition).forEach((condition) => {
            if (!validConditionsArguments.includes(condition)) {
                throw new InvalidArgumentError(`Invalid condition argument ${condition}`);
            }
        });
    }
}

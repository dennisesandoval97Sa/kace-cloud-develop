import { ValueObjectJson } from '../../../shared/domain/value-object/ValueObjectJson';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';
import { Helper } from '../../../shared';

export class ValueObjectFilterInput extends ValueObjectJson {
    static MINIMUM_NODES = 0;

    constructor(value) {
        super('filter_input', value);
        this.#ensureValidFilterInput(value);
    }

    /**
     * Ensures that the filter Input is valid by running all necessary validations.
     *
     * @param {Object} value - The value of the diagram to validate
     * @throws {InvalidArgumentError} If the diagram fails the validations
     */
    #ensureValidFilterInput(value) {
        this.#ensureValidNodes(value.filter_input);
    }

    /**
     * Validates that filter_input is a valid array and meets the minimum requirements
     *
     * @param {*} nodes - The value of nodes to validate
     * @throws {InvalidArgumentError} If nodes does not meet the requirements
     */
    #ensureValidNodes(nodes) {
        if (!Array.isArray(nodes)) {
            Helper.logError(`${this.field}: The "filter input" property must be an array`);
            throw new InvalidArgumentError(`${this.field}: The "filter input" property must be an array`);
        }

        if (nodes.length < ValueObjectFilterInput.MINIMUM_NODES) {
            Helper.logError(
                `${this.field}: The filter Input must have at least ${ValueObjectFilterInput.MINIMUM_NODES} node`
            );
            throw new InvalidArgumentError(
                `${this.field}: The filter Input must have at least ${ValueObjectFilterInput.MINIMUM_NODES} node`
            );
        }
    }
}

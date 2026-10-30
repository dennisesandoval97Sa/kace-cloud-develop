import { Helper, InvalidArgumentError, ValueObjectJson } from '../../../shared/index.js';

export class ValueObjectJsonDiagramProperties extends ValueObjectJson {
    static MINIMUM_NODES = 1;

    constructor(value) {
        super('json_diagram_properties', value);
        this.#ensureValidDiagram(value);
    }

    /**
     * Ensures that the diagram is valid by running all necessary validations.
     *
     * @param {Object} value - The value of the diagram to validate
     * @throws {InvalidArgumentError} If the diagram fails the validations
     */
    #ensureValidDiagram(value) {
        this.#ensureValidNodes(value.nodes);
        this.#ensureValidEdges(value.edges);
    }

    /**
     * Validates that nodes is a valid array and meets the minimum requirements
     *
     * @param {*} nodes - The value of nodes to validate
     * @throws {InvalidArgumentError} If nodes does not meet the requirements
     */
    #ensureValidNodes(nodes) {
        if (!Array.isArray(nodes)) {
            Helper.logError(`${this.field}: The "nodes" property must be an array`);
            throw new InvalidArgumentError(`${this.field}: The "nodes" property must be an array`);
        }

        if (nodes.length < ValueObjectJsonDiagramProperties.MINIMUM_NODES) {
            Helper.logError(
                `${this.field}: The diagram must have at least ${ValueObjectJsonDiagramProperties.MINIMUM_NODES} node`
            );
            throw new InvalidArgumentError(
                `${this.field}: The diagram must have at least ${ValueObjectJsonDiagramProperties.MINIMUM_NODES} node`
            );
        }
    }

    /**
     * Validates that edges (if it exists) is a valid array
     *
     * @param {*} edges - The value of edges to validate
     * @throws {InvalidArgumentError} If edges exists and is not a valid array
     */
    #ensureValidEdges(edges) {
        if (edges !== undefined) {
            if (!Array.isArray(edges)) {
                Helper.logError(`${this.field}: The "edges" property, when it exists, must be an array`);
                throw new InvalidArgumentError(`${this.field}: The "edges" property, when it exists, must be an array`);
            }
        }
    }
}

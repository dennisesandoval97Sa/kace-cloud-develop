import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectFunctionId } from './value-objects/ValueObjectFunctionId.js';
import { ValueObjectEndPointId } from './value-objects/ValueObjectEndPointId.js';
import { ValueObjectFlowId } from './value-objects/ValueObjectFlowId.js';
import { ValueObjectOrder } from './value-objects/ValueObjectOrder.js';
import { ValueObjectConditionalId } from './value-objects/ValueObjectConditionalId.js';
import { ValidationFailError } from '../../shared/errors/ValidationFailError.js';

/**
 * @typedef {Object} WSRestWorkflowStepRelations
 *
 * @property {AggregateRoot|null} flow Relationship with the flow
 * @property {AggregateRoot|null} endpoint Relationship with the endpoint
 * @property {AggregateRoot|null} function Relationship with the function
 * @property {AggregateRoot|null} conditional Relationship with the conditional
 */

/**
 * Class representing a WSRestWorkflowStep.
 */
export class WSRestWorkflowStep extends AggregateRoot {
    /**
     * @type {ValueObjectFlowId} is initialized in the constructor
     */
    #flow_id;

    /**
     * @type {ValueObjectOrder} is initialized in the constructor
     */
    #order;

    /**
     * @type {ValueObjectEndPointId} is initialized in the constructor
     */
    #endpoint_id;

    /**
     * @type {ValueObjectFunctionId} is initialized in the constructor
     */
    #function_id;

    /**
     * @type {ValueObjectConditionalId} is initialized in the constructor
     */
    #conditional_id;

    /**
     * @type {WSRestWorkflowStepRelations} Property to hold the relations
     */
    #relations;

    constructor(dto) {
        super(dto.id);

        this.#initializeValueObjects(dto);
        this.#initializeAuditFields(dto);
        this.#initializeRelations(dto);

        this.#validateEndpointOrFunction();
    }

    #initializeValueObjects(dto) {
        this.#flow_id = new ValueObjectFlowId(dto.flow_id);
        this.#order = new ValueObjectOrder(dto.order);
        this.#endpoint_id = new ValueObjectEndPointId(dto.endpoint_id);
        this.#function_id = new ValueObjectFunctionId(dto.function_id);
        this.#conditional_id = new ValueObjectConditionalId(dto.conditional_id);
    }

    #initializeAuditFields(dto) {
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.deleted_at = dto.deleted_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_by = dto.deleted_by;
    }

    #initializeRelations() {
        this.#relations = {
            flow: null,
            endpoint: null,
            function: null,
            conditional: null,
        };
    }

    /**
     * Create a new WSRestWorkflowStep instance from a DTO
     * @param {Object} dto
     * @returns {WSRestWorkflowStep}
     */
    static create(dto) {
        return new WSRestWorkflowStep(dto);
    }

    set flow_id(value) {
        if (!this.#areEqual(this.#flow_id.value, value)) {
            this.#flow_id = new ValueObjectFlowId(value);
            this.changedAttributes.flow_id = this.#flow_id.value;
        }
    }

    set order(value) {
        if (!this.#areEqual(this.#order.value, value)) {
            this.#order = new ValueObjectOrder(value);
            this.changedAttributes.order = this.#order.value;
        }
    }

    set endpoint_id(value) {
        if (!this.#areEqual(this.#endpoint_id.value, value)) {
            this.#endpoint_id = new ValueObjectEndPointId(value);
            this.changedAttributes.endpoint_id = this.#endpoint_id.value;
        }
    }

    set function_id(value) {
        if (!this.#areEqual(this.#function_id.value, value)) {
            this.#function_id = new ValueObjectFunctionId(value);
            this.changedAttributes.function_id = this.#function_id.value;
        }
    }

    /**
     * @returns {ValueObjectFlowId}
     */
    get flow_id() {
        return this.#flow_id;
    }

    /**
     * @returns {ValueObjectOrder}
     */
    get order() {
        return this.#order;
    }

    /**
     * @returns {ValueObjectEndPointId}
     */
    get endpoint_id() {
        return this.#endpoint_id;
    }

    /**
     * @returns {ValueObjectFunctionId}
     */
    get function_id() {
        return this.#function_id;
    }

    /**
     * @returns {ValueObjectConditionalId}
     */
    get conditional_id() {
        return this.#conditional_id;
    }

    /**
     * @returns {AggregateRoot|null}
     */
    get flow() {
        return this.#relations.flow;
    }

    /**
     * @returns {AggregateRoot|null}
     */
    get endpoint() {
        return this.#relations.endpoint;
    }

    /**
     * @returns {AggregateRoot|null}
     */
    get function() {
        return this.#relations.function;
    }

    setFlow(flow) {
        this.#relations.flow = flow;
    }

    setEndpoint(endpoint) {
        this.#relations.endpoint = endpoint;
    }

    setFunction(functionObject) {
        this.#relations.function = functionObject;
    }

    get conditional() {
        return this.#relations.conditional;
    }

    setConditional(conditional) {
        this.#relations.conditional = conditional;
    }

    /**
     * Private method to compare values.
     * @param {any} value
     * @param {any} otherValue
     * @returns {boolean}
     */
    #areEqual(value, otherValue) {
        return value === otherValue;
    }

    /**
     * Validate that exactly one of endpoint_id, function_id, or conditional_id is set.
     * @throws {Error} If more than one or none are set.
     */
    #validateEndpointOrFunction() {
        const fields = {
            endpoint_id: this.#endpoint_id?.value != null,
            function_id: this.#function_id?.value != null,
            conditional_id: this.#conditional_id?.value != null,
        };

        const setFields = Object.entries(fields)
            .filter(([, isSet]) => isSet)
            .map(([name]) => name);

        if (setFields.length === 0) {
            throw new ValidationFailError(
                'WSRestWorkflowStep invalid: one of endpoint_id, function_id, or conditional_id must be provided',
                'id'
            );
        }

        if (setFields.length > 1) {
            throw new ValidationFailError(
                `WSRestWorkflowStep invalid: only one of endpoint_id, function_id, or conditional_id must be set, but received: ${setFields.join(', ')}`,
                'id'
            );
        }
    }

    /**
     * @override
     */
    toJson() {
        const json = super.toJson();

        const relations = {
            flow: this.#relations.flow ? this.#relations.flow.toJson() : null,
            endpoint: this.#relations.endpoint ? this.#relations.endpoint.toJson() : null,
            function: this.#relations.function ? this.#relations.function.toJson() : null,
            conditional: this.#relations.conditional ? this.#relations.conditional.toJson() : null,
        };

        return {
            ...json,
            relations,
        };
    }
}

import { AggregateRoot } from '../../shared';
import { ValueObjectDescription } from './value-objects/ValueObjectDescription';
import { ValueObjectExternalCode } from './value-objects/ValueObjectExternalCode';
import { ValueObjectInitialContext } from './value-objects/ValueObjectInitialContext';
import { ValueObjectIsActive } from './value-objects/ValueObjectIsActive';
import { ValueObjectIsPrimary } from './value-objects/ValueObjectIsPrimary';
import { ValueObjectJsonDiagramProperties } from './value-objects/ValueObjectJsonDiagramProperties';

export class WSRestFlow extends AggregateRoot {
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;

    /** @type {ValueObjectExternalCode} */
    #external_code;

    /** @type {ValueObjectJsonDiagramProperties} */
    #json_diagram_properties;

    /** @type {ValueObjectIsActive} */
    #is_active;

    /** @type {ValueObjectIsPrimary} */
    #is_primary;

    /** @type {ValueObjectInitialContext} */
    #initial_context;

    constructor({
        id,
        description,
        external_code,
        json_diagram_properties,
        is_primary,
        is_active,
        initial_context,
        created_at,
        updated_at,
        created_by,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#description = new ValueObjectDescription(description ?? 'default');
        this.#external_code = new ValueObjectExternalCode(external_code ?? 'default');
        this.#json_diagram_properties = new ValueObjectJsonDiagramProperties(json_diagram_properties);
        this.#initial_context = new ValueObjectInitialContext(initial_context ?? {});
        this.#is_primary = new ValueObjectIsPrimary(is_primary !== undefined ? is_primary : true);
        this.#is_active = new ValueObjectIsActive(is_active ?? false);
        this.created_at = created_at;
        this.updated_at = updated_at;
        this.created_by = created_by;
        this.updated_by = updated_by;
        this.deleted_at = deleted_at;
        this.deleted_by = deleted_by;
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (this.#description.value !== value) {
            this.#description = new ValueObjectDescription(value);
            this.changedAttributes.description = value;
        }
    }

    get external_code() {
        return this.#external_code;
    }

    set external_code(value) {
        if (this.#external_code.value !== value) {
            this.#external_code = new ValueObjectExternalCode(value);
            this.changedAttributes.external_code = value;
        }
    }

    get json_diagram_properties() {
        return this.#json_diagram_properties;
    }

    set json_diagram_properties(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#json_diagram_properties.value !== value) {
            this.#json_diagram_properties = new ValueObjectJsonDiagramProperties(value);
            this.changedAttributes.json_diagram_properties = value;
        }
    }

    get initial_context() {
        return this.#initial_context;
    }

    set initial_context(value) {
        if (this.#initial_context.value !== value) {
            this.#initial_context = new ValueObjectInitialContext(value);
            this.changedAttributes.initial_context = value;
        }
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectIsActive(value);
            this.changedAttributes.is_active = value;
        }
    }

    get is_primary() {
        return this.#is_primary;
    }

    set is_primary(value) {
        if (this.#is_primary.value !== value) {
            this.#is_primary = new ValueObjectIsPrimary(value);
            this.changedAttributes.is_primary = value;
        }
    }

    /**
     * Creates a new WSRestFlow object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the WSRestFlow object.
     * @returns {WSRestFlow} A new instance of the WSRestFlow class.
     */
    static create(dto) {
        return new WSRestFlow(dto);
    }
}

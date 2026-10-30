import {
    AggregateRoot,
    ValueObjectColor,
    ValueObjectSharedVisualColor,
    ValueObjectSharedVisualIcon,
    ValueObjectStatus,
} from '../../shared';
import {
    ValueObjectIcon,
    ValueObjectRequireObservation as ValueObjectRequireObservation,
    ValueObjectStateDescription,
    ValueObjectStateName,
} from '../index';

export class State extends AggregateRoot {
    #nombre;
    /** @type {ValueObjectStateDescription} is initialized in the constructor */
    #descripcion;
    /** @type {ValueObjectIcon} is initialized in the constructor */
    #icon_class;
    /** @type {ValueObjectStatus} is initialized in the constructor */
    #status;
    /** @type {ValueObjectColor} is initialized in the constructor */
    #color;
    /** @type {ValueObjectRequireObservation} is initialized in the constructor */
    #require_observation;

    constructor(dto, options = {}) {
        if (!dto) return undefined;
        const { validateVisualOptions = false } = options;
        super(dto.id);
        this.#nombre = new ValueObjectStateName('Nombre', dto.nombre ?? 'default');
        this.#descripcion = new ValueObjectStateDescription('Descripción', dto.descripcion ?? 'default');
        this.#icon_class = validateVisualOptions
            ? new ValueObjectSharedVisualIcon(
                  'icon class',
                  dto.icon_class,
                  dto.icon_class === null || dto.icon_class === undefined
              )
            : new ValueObjectIcon('icon class', dto.icon_class, true);
        this.#status = new ValueObjectStatus('status', dto.status);
        this.#color = validateVisualOptions
            ? new ValueObjectSharedVisualColor('color', dto.color, dto.color === null || dto.color === undefined)
            : new ValueObjectColor('color', dto.color, true);
        this.#require_observation = new ValueObjectRequireObservation(
            'requireObservation',
            Boolean(dto.require_observation),
            true
        );
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        this.#nombre = new ValueObjectStateName('Nombre', value);
        this.changedAttributes.nombre = this.#nombre.value;
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        this.#descripcion = new ValueObjectStateDescription('Descripción', value);
        this.changedAttributes.descripcion = this.#descripcion.value;
    }

    get icon_class() {
        return this.#icon_class;
    }

    set icon_class(value) {
        this.#icon_class = new ValueObjectSharedVisualIcon('icon class', value, value == null);
        this.changedAttributes.icon_class = this.#icon_class.value;
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        this.#status = new ValueObjectStatus('status', value);
        this.changedAttributes.status = this.#status.value;
    }

    get color() {
        return this.#color;
    }

    set color(value) {
        this.#color = new ValueObjectSharedVisualColor('color', value, value == null);
        this.changedAttributes.color = this.#color.value;
    }

    get require_observation() {
        return this.#require_observation;
    }

    set require_observation(value) {
        this.#require_observation = new ValueObjectRequireObservation('requireObservation', value);
        this.changedAttributes.require_observation = this.#require_observation.value;
    }

    /**
     * Creates a new State object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the State object.
     * @returns {State} A new instance of the State class.
     */
    static create(dto) {
        return new State(dto, { validateVisualOptions: true });
    }
}

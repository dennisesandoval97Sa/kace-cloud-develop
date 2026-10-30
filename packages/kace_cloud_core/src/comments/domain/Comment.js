import { AggregateRoot, InvalidArgumentError, ValueObjectUuid } from '../../shared/index.js';
import { ValueObjectDescripcion } from './value-object/ValueObjectDescripcion';
import { ValueObjectCalificacion } from './value-object/ValueObjectCalificacion';
import Creator from '../../shared/domain/aggregates/Creator.js';

export class Comment extends AggregateRoot {
    /** @type {ValueObjectDescripcion} is initialized in the constructor */
    #descripcion;
    /** @type {ValueObjectCalificacion} is initialized in the constructor */
    #calificacion;
    /** @type {{ ValueObjectUuid }} is initialized in the constructor */
    #caso_id;
    /** @type {Creator || null} is initialized in the constructor */
    #creator;

    /**
     * @param {Object} dto - Data transfer object containing the initial values.
     * @param {string} dto.id - Unique identifier.
     * @param {string} dto.descripcion - Description.
     * @param {number} dto.calificacion - Rating.
     * @param {string} dto.caso_id - UUID of the case.
     * @param {string} dto.created_at - Timestamp of creation.
     * @param {string} dto.updated_at - Timestamp of last update.
     * @param {string} dto.created_by - UUID of the creator.
     * @param {string} dto.updated_by - UUID of the last updater.
     */
    constructor(dto, creator = null) {
        super(dto.id);
        this.#descripcion = new ValueObjectDescripcion('descripcion', dto.descripcion ?? 'default');
        this.#calificacion = new ValueObjectCalificacion('calificacion', dto.calificacion, true);
        this.#caso_id = new ValueObjectUuid('caso_id', dto.caso_id);
        this.#ensureCreatorIsValid(creator);
        this.#creator = creator;
        this.created_by = dto.created_by;
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        this.#descripcion = new ValueObjectDescripcion('descripcion', value);
        this.changedAttributes.descripcion = this.#descripcion.value;
    }

    get calificacion() {
        return this.#calificacion;
    }

    set calificacion(value) {
        this.#calificacion = new ValueObjectCalificacion('calificacion', value);
        this.changedAttributes.calificacion = this.#calificacion.value;
    }

    get caso_id() {
        return this.#caso_id;
    }

    set caso_id(value) {
        this.#caso_id = new ValueObjectUuid('caso_id', value);
    }

    /**
     * Creates a new Comment object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the Comment object.
     * @returns {Comment} A new instance of the Comment class.
     */
    static create(dto) {
        return new Comment(dto);
    }

    #ensureCreatorIsValid(creator) {
        if (creator === null || creator instanceof Creator) {
            return;
        }
        throw new InvalidArgumentError('Comment: The creator must be an instance of Creator');
    }

    get creator() {
        return this.#creator;
    }

    set creator(value) {
        this.#ensureCreatorIsValid(value);
        this.#creator = value;
    }
}

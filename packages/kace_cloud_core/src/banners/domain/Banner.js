import { AggregateRoot, ValueObjectStatus } from '../../shared';
import { ValueObjectDate } from './value-object/ValueObjectDate.js';
import { ValueObjectDescripcion } from './value-object/ValueObjectDescripcion.js';
import { ValueObjectPropertiesInstance } from './value-object/ValueObjectPropertiesInstance';
import { ValueObjectSpecificationsInstance } from './value-object/ValueObjectSpecificationsInstance';
import { Properties } from './Properties';
import { Specifications } from './Specifications';
import { CustomError } from '../../shared/errors/CustomError';

export class Banner extends AggregateRoot {
    /**
     * @type {ValueObjectDescripcion}
     * is initialized in the constructor
     */
    #descripcion;

    /**
     * @type {ValueObjectPropertiesInstance}
     * is initialized in the constructor
     */
    #propiedades;

    /**
     * @type {ValueObjectDate}
     * is initialized in the constructor
     */
    #fecha_inicio;

    /**
     * @type {ValueObjectDate}
     * is initialized in the constructor
     */
    #fecha_fin;

    /**
     * @type {ValueObjectSpecificationsInstance}
     * is initialized in the constructor
     */
    #especificaciones;

    /**
     * @type {ValueObjectStatus}
     * is initialized in the constructor
     */
    #status;

    /**
     * @param {Object} dto - Data transfer object containing the initial values.
     * @param {string} dto.id - Unique identifier.
     * @param {string} dto.descripcion - Description.
     * @param {Object} dto.propiedades - Properties in JSON format.
     * @param {string} dto.fecha_inicio - Start date.
     * @param {string} dto.fecha_fin - End date.
     * @param {Object} dto.especificaciones - Specifications in JSON format.
     * @param {number} dto.status - Status code.
     * @param {string} dto.created_at - Timestamp of creation.
     * @param {string} dto.updated_at - Timestamp of last update.
     * @param {string} dto.created_by - UUID of the creator.
     * @param {string} dto.updated_by - UUID of the last updater.
     * @param {string} dto.deleted_at - Timestamp of deletion.
     * @param {string} dto.deleted_by - UUID of the deleter.
     */
    constructor(dto, options = {}) {
        const { validateVisualOptions = false } = options;
        super(dto.id);
        this.#descripcion = new ValueObjectDescripcion('descripcion', dto.descripcion ?? 'default');
        const properties = new Properties(dto.propiedades, { validateVisualOptions });
        this.#propiedades = new ValueObjectPropertiesInstance(properties);
        this.#fecha_inicio = new ValueObjectDate('fecha_inicio', dto.fecha_inicio ?? new Date());
        this.#fecha_fin = new ValueObjectDate('fecha_fin', dto.fecha_fin ?? new Date(Date.now() + 86400000));
        this.#validateStartEndDates(this.#fecha_inicio, this.#fecha_fin);
        const SpecificationsInstance = new Specifications(dto.especificaciones);
        this.#especificaciones = new ValueObjectSpecificationsInstance(SpecificationsInstance);
        this.#status = new ValueObjectStatus('status', dto.status);
        this.created_by = dto.created_by;
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        this.#descripcion = new ValueObjectDescripcion('descripcion', value);
        this.changedAttributes.descripcion = this.#descripcion.value;
    }

    get propiedades() {
        return this.#propiedades;
    }

    set propiedades(value) {
        const properties = new Properties(value, { validateVisualOptions: true });
        this.#propiedades = new ValueObjectPropertiesInstance(properties);
        this.changedAttributes.propiedades = this.#propiedades.value;
    }

    get fecha_inicio() {
        return this.#fecha_inicio;
    }

    set fecha_inicio(value) {
        this.#fecha_inicio = new ValueObjectDate('fecha_inicio', value);
        this.#validateStartEndDates(this.#fecha_inicio, this.#fecha_fin);
        this.changedAttributes.fecha_inicio = this.#fecha_inicio.value;
    }

    get fecha_fin() {
        return this.#fecha_fin;
    }

    set fecha_fin(value) {
        this.#fecha_fin = new ValueObjectDate('fecha_fin', value);
        this.#validateStartEndDates(this.#fecha_inicio, this.#fecha_fin);
        this.changedAttributes.fecha_fin = this.#fecha_fin.value;
    }

    get especificaciones() {
        return this.#especificaciones;
    }

    set especificaciones(value) {
        const SpecificationsInstance = new Specifications(value);
        this.#especificaciones = new ValueObjectSpecificationsInstance(SpecificationsInstance);
        this.changedAttributes.especificaciones = this.#especificaciones.value;
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        this.#status = new ValueObjectStatus('status', value);
        this.changedAttributes.status = this.#status.value;
    }

    /**
     * Creates a new Banner object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the Banner object.
     * @returns {Banner} A new instance of the Banner class.
     */
    static create(dto) {
        return new Banner(dto, { validateVisualOptions: true });
    }

    #validateStartEndDates(date_start, date_end) {
        const startDate = date_start.date;
        const endDate = date_end.date;

        if (startDate > endDate) {
            throw new CustomError('The start date cannot be later than the end date.', 400);
        }
    }
}

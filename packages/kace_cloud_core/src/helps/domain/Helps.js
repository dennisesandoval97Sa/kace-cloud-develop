import { AggregateRoot } from '../../shared';
import { ValueObjectColor } from '../../shared/domain/value-object/ValueObjectColor';
import { ValueObjectBoolean } from '../../shared/domain/value-object/ValueObjectBoolean';
import { ValueObjectSharedVisualColor } from '../../shared/domain/value-object/ValueObjectSharedVisualColor.js';
import { ValueObjectDescripcion } from './ValueObjectDescripcion';
import { ValueObjectTitulo } from './ValueObjectTitulo';

export class Helps extends AggregateRoot {
    /** @type {ValueObjectDescripcion} is initialized in the constructor */
    #descripcion;
    /** @type {ValueObjectTitulo} is initialized in the constructor */
    #titulo;
    /** @type {ValueObjectColor} is initialized in the constructor */
    #color;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;

    constructor(dto, options = {}) {
        const { validateVisualOptions = false } = options;
        super(dto.id);
        this.#titulo = new ValueObjectTitulo('titulo', dto.titulo ?? 'default');
        this.#descripcion = new ValueObjectDescripcion('descripcion', dto.descripcion ?? 'default');
        this.#color = validateVisualOptions
            ? new ValueObjectSharedVisualColor('color', dto.color, dto.color === null || dto.color === undefined)
            : new ValueObjectColor('color', dto.color ?? '#FF0000');
        this.#is_active = new ValueObjectBoolean('is_active', dto.is_active ?? false);
        this.created_by = dto.created_by;
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    static create(dto) {
        return new Helps(dto, { validateVisualOptions: true });
    }

    get descripcion() {
        return this.#descripcion;
    }
    get titulo() {
        return this.#titulo;
    }
    get color() {
        return this.#color;
    }
    get is_active() {
        return this.#is_active;
    }

    set descripcion(value) {
        if (value != this.#descripcion.value) {
            this.#descripcion = new ValueObjectDescripcion('descripcion', value);
            this.changedAttributes.descripcion = this.#descripcion.value;
        }
    }
    set titulo(value) {
        if (value != this.#titulo.value) {
            this.#titulo = new ValueObjectTitulo('titulo', value);
            this.changedAttributes.titulo = this.#titulo.value;
        }
    }
    set color(value) {
        if (value != this.#color.value) {
            this.#color = new ValueObjectSharedVisualColor('color', value, value == null);
            this.changedAttributes.color = this.#color.value;
        }
    }
    set is_active(value) {
        if (value != this.#is_active.value) {
            this.#is_active = new ValueObjectBoolean('is_active', value);
            this.changedAttributes.is_active = this.#is_active.value;
        }
    }
}

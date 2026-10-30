import {
    AggregateRoot,
    DEFAULT_ANS_VISUAL_COLORS,
    ValueObjectColor,
    ValueObjectInt,
    ValueObjectName,
    ValueObjectSharedVisualColor,
} from '../../shared/index.js';
import { ValueObjectTypes } from './ValueObjectTypes.js';

export class Ans extends AggregateRoot {
    /** @type {ValueObjectName} is initialized in the constructor */
    #nombre;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #intermedio;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #vencido;

    /** @type {ValueObjectColor} is initialized in the constructor */
    #color_ans_inicial;

    /** @type {ValueObjectColor} is initialized in the constructor */
    #color_ans_intermedio;

    /** @type {ValueObjectColor} is initialized in the constructor */
    #color_ans_final;

    /** @type {ValueObjectTypes} is initialized in the constructor */
    #medicion_ans_id;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #status;

    constructor(dto, options = {}) {
        const { validateVisualOptions = false } = options;
        super(dto.id);
        this.#nombre = new ValueObjectName('nombre', dto.nombre ?? 'default');
        this.#intermedio = new ValueObjectInt('intermedio', dto.intermedio ?? 1);
        this.#vencido = new ValueObjectInt('vencido', dto.vencido ?? 2);
        this.#color_ans_inicial = validateVisualOptions
            ? new ValueObjectSharedVisualColor(
                  'color_ans_inicial',
                  dto.color_ans_inicial ?? DEFAULT_ANS_VISUAL_COLORS.initial
              )
            : new ValueObjectColor('color_ans_inicial', dto.color_ans_inicial ?? DEFAULT_ANS_VISUAL_COLORS.initial);
        this.#color_ans_intermedio = validateVisualOptions
            ? new ValueObjectSharedVisualColor(
                  'color_ans_intermedio',
                  dto.color_ans_intermedio ?? DEFAULT_ANS_VISUAL_COLORS.intermediate
              )
            : new ValueObjectColor(
                  'color_ans_intermedio',
                  dto.color_ans_intermedio ?? DEFAULT_ANS_VISUAL_COLORS.intermediate
              );
        this.#color_ans_final = validateVisualOptions
            ? new ValueObjectSharedVisualColor(
                  'color_ans_final',
                  dto.color_ans_final ?? DEFAULT_ANS_VISUAL_COLORS.final
              )
            : new ValueObjectColor('color_ans_final', dto.color_ans_final ?? DEFAULT_ANS_VISUAL_COLORS.final);
        this.#medicion_ans_id = new ValueObjectTypes('medicion_ans_id', dto.medicion_ans_id);
        this.#status = new ValueObjectInt('status', dto.status ?? 2);
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        value = new ValueObjectName('nombre', value);
        this.#nombre = value;
        this.changedAttributes.nombre = this.#nombre.value;
    }

    get intermedio() {
        return this.#intermedio;
    }

    set intermedio(value) {
        value = new ValueObjectInt('intermedio', value);
        this.#intermedio = value;
        this.changedAttributes.intermedio = this.#intermedio.value;
    }

    get vencido() {
        return this.#vencido;
    }

    set vencido(value) {
        value = new ValueObjectInt('vencido', value);
        this.#vencido = value;
        this.changedAttributes.vencido = this.#vencido.value;
    }

    get color_ans_inicial() {
        return this.#color_ans_inicial;
    }

    set color_ans_inicial(value) {
        value = new ValueObjectSharedVisualColor('color_ans_inicial', value);
        this.#color_ans_inicial = value;
        this.changedAttributes.color_ans_inicial = this.#color_ans_inicial.value;
    }

    get color_ans_intermedio() {
        return this.#color_ans_intermedio;
    }

    set color_ans_intermedio(value) {
        value = new ValueObjectSharedVisualColor('color_ans_intermedio', value);
        this.#color_ans_intermedio = value;
        this.changedAttributes.color_ans_intermedio = this.#color_ans_intermedio.value;
    }

    get color_ans_final() {
        return this.#color_ans_final;
    }

    set color_ans_final(value) {
        value = new ValueObjectSharedVisualColor('color_ans_final', value);
        this.#color_ans_final = value;
        this.changedAttributes.color_ans_final = this.#color_ans_final.value;
    }

    get medicion_ans_id() {
        return this.#medicion_ans_id;
    }

    set medicion_ans_id(value) {
        value = new ValueObjectTypes('medicion_ans_id', value);
        this.#medicion_ans_id = value;
        this.changedAttributes.medicion_ans_id = this.#medicion_ans_id.value;
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        value = new ValueObjectInt('status', value);
        this.#status = value;
        this.changedAttributes.status = this.#status.value;
    }

    /**
     * Creates a new Ans object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the Ans object.
     * @returns {Ans} A new instance of the Ans class.
     */
    static create(dto) {
        return new Ans(dto, { validateVisualOptions: true });
    }
}

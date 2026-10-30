import { AggregateRoot, ValueObjectStatus } from '../../shared';
import { ValueObjectFlowName, ValueObjectJsonFlow } from '../index';

export class Flow extends AggregateRoot {
    /** @type {ValueObjectFlowName} is initialized in the constructor */
    #nombre;
    /** @type {ValueObjectJsonFlow} is initialized in the constructor */
    #json_flujo;
    /** @type {ValueObjectStatus} is initialized in the constructor */
    #status;

    constructor(dto) {
        super(dto.id);
        this.#nombre = new ValueObjectFlowName('nombre flujo', dto.nombre ?? 'default');
        this.#json_flujo = new ValueObjectJsonFlow('json flujo', dto.json_flujo);
        this.#status = new ValueObjectStatus('status', dto.status);
        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    static create(dto) {
        return new Flow(dto);
    }

    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        this.#nombre = new ValueObjectFlowName('Nombre flujo', value);
        this.changedAttributes.nombre = this.#nombre.value;
    }

    get json_flujo() {
        return this.#json_flujo;
    }

    set json_flujo(value) {
        this.#json_flujo = new ValueObjectJsonFlow('Json flujo', value);
        this.changedAttributes.json_flujo = this.#json_flujo.value;
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        this.#status = new ValueObjectStatus('status', value);
        this.changedAttributes.status = this.#status.value;
    }

    getActiveTransitions() {
        const activeIds = this.changedAttributes.json_flujo.edges.map((e) => e.kace_transition).filter(Boolean) || [];
        return activeIds;
    }
}

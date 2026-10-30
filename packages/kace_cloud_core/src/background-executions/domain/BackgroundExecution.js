import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectExecutionStatus } from './value-objects/ValueObjectExecutionStatus.js';
import { ValueObjectProccessDescription } from './value-objects/ValueObjectProccessDescription.js';

export class BackgroundExecution extends AggregateRoot {
    /** @type {ValueObjectProccessDescription} is initialized in the constructor */
    #proccess_description;

    /** @type {ValueObjectExecutionStatus} is initialized in the constructor */
    #execution_status;

    constructor({ id, proccess_description, execution_status, updated_at, updated_by, deleted_at, deleted_by }) {
        super(id);
        this.#proccess_description = new ValueObjectProccessDescription(proccess_description);
        this.#execution_status = new ValueObjectExecutionStatus(execution_status ?? false);
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get proccess_description() {
        return this.#proccess_description;
    }

    set proccess_description(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#proccess_description.value !== value) {
            this.#proccess_description = new ValueObjectProccessDescription(value);
            this.changedAttributes.proccess_description = value;
        }
    }

    get execution_status() {
        return this.#execution_status;
    }

    set execution_status(value) {
        if (this.#execution_status.value !== value) {
            this.#execution_status = new ValueObjectExecutionStatus(value);
            this.changedAttributes.execution_status = value;
        }
    }

    /**
     * Creates a new BackgroundExecution object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the BackgroundExecution object.
     * @returns {BackgroundExecution} A new instance of the BackgroundExecution class.
     */
    static create(dto) {
        return new BackgroundExecution(dto);
    }

    isRunning() {
        return !!this.execution_status.value;
    }

    /**
     * Verifica si el proceso está marcado como en ejecución pero su tiempo de bloqueo
     * (lock lease) ha expirado, indicando que el proceso "murió" inesperadamente.
     *
     * @param {number} timeoutMinutes El tiempo máximo esperado antes de considerar el proceso como "stale"
     * @returns {boolean}
     */
    isStale(timeoutMinutes = 15) {
        if (!this.isRunning()) {
            return false;
        }

        if (!this.updated_at?.value) {
            return false;
        }
        const updatedAt = new Date(this.updated_at.value);

        const now = new Date();
        const diffMs = now - updatedAt;
        return diffMs > timeoutMinutes * 60 * 1000;
    }
}

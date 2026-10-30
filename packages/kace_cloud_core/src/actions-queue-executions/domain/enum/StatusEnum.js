import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';
import { Helper } from '../../../shared';

export class StatusEnum {
    static PENDING = new StatusEnum('PENDING', 'pending');
    static IN_PROGRESS = new StatusEnum('IN_PROGRESS', 'in_progress');
    static FAILED = new StatusEnum('FAILED', 'failed');
    static COMPLETED = new StatusEnum('COMPLETED', 'completed');

    constructor(key, value) {
        this.#ensureIsValidStatus(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        for (const status of [StatusEnum.PENDING, StatusEnum.IN_PROGRESS, StatusEnum.FAILED, StatusEnum.COMPLETED]) {
            if (value === status.value) {
                return status;
            }
        }
        Helper.logError(`Invalid status value: ${value}`);
        throw new InvalidArgumentError(`Invalid status value: ${value}`);
    }

    static toJson() {
        return {
            PENDING: StatusEnum.PENDING.value,
            IN_PROGRESS: StatusEnum.IN_PROGRESS.value,
            FAILED: StatusEnum.FAILED.value,
            COMPLETED: StatusEnum.COMPLETED.value,
        };
    }

    #ensureIsValidStatus(value) {
        if (!value) {
            throw new InvalidArgumentError('The status value cannot be null');
        }

        const validValues = ['pending', 'in_progress', 'failed', 'completed'];

        if (!validValues.includes(value)) {
            throw new InvalidArgumentError(`The value must be a valid status: ${value}`);
        }
    }
}

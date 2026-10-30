import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';
import { Helper } from '../../infrastructure/utils/Helper';

export class BackgroundProcessEnum {
    static ACTION_QUEUE_EXECUTION = new BackgroundProcessEnum('ACTION_QUEUE_EXECUTION', 'action_queue_execution');
    static ACTION_QUEUE_EXECUTOR = new BackgroundProcessEnum('ACTION_QUEUE_EXECUTOR', 'action_queue_executor');
    static ANS_CALCULATION = new BackgroundProcessEnum('ANS_CALCULATION', 'ans_calculation');
    static IMPORTS_PROCESSOR = new BackgroundProcessEnum('IMPORTS_PROCESSOR', 'imports_processor');
    static AUTOMATED_GROUP_ASSIGNMENT = new BackgroundProcessEnum(
        'AUTOMATED_GROUP_ASSIGNMENT',
        'automated_group_assignment'
    );

    constructor(key, value) {
        this.#ensureIsValidBackgroundProcess(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        for (const status of [
            BackgroundProcessEnum.ACTION_QUEUE_EXECUTION,
            BackgroundProcessEnum.ACTION_QUEUE_EXECUTOR,
            BackgroundProcessEnum.ANS_CALCULATION,
            BackgroundProcessEnum.IMPORTS_PROCESSOR,
            BackgroundProcessEnum.AUTOMATED_GROUP_ASSIGNMENT,
        ]) {
            if (value === status.value) {
                return status;
            }
        }
        throw new InvalidArgumentError(`Invalid backgorund process value: ${value}`);
    }

    static toJson() {
        return {
            ACTION_QUEUE_EXECUTION: BackgroundProcessEnum.ACTION_QUEUE_EXECUTION.value,
            ACTION_QUEUE_EXECUTOR: BackgroundProcessEnum.ACTION_QUEUE_EXECUTOR.value,
            ANS_CALCULATION: BackgroundProcessEnum.ANS_CALCULATION.value,
            IMPORTS_PROCESSOR: BackgroundProcessEnum.IMPORTS_PROCESSOR.value,
            AUTOMATED_GROUP_ASSIGNMENT: BackgroundProcessEnum.AUTOMATED_GROUP_ASSIGNMENT.value,
        };
    }

    #ensureIsValidBackgroundProcess(value) {
        if (!value) {
            Helper.logError(`The background process value cannot be null`);
            throw new InvalidArgumentError('The background process value cannot be null');
        }

        const validValues = [
            'action_queue_execution',
            'action_queue_executor',
            'ans_calculation',
            'imports_processor',
            'automated_group_assignment',
        ];

        if (!validValues.includes(value)) {
            Helper.logError(`The value must be a valid background process: ${value}`);
            throw new InvalidArgumentError(`The value must be a valid background process: ${value}`);
        }
    }
}

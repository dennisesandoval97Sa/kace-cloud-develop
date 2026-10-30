import { v4 as uuidv4 } from 'uuid';
import { BackgroundExecution } from '../../../src/background-executions/domain/BackgroundExecution';
import { BackgroundProcessEnum } from '../../../src/shared/domain/enum/BackgroundProcessEnum';

export default class BackgroundExecutionMother {
    static dto({ id, proccess_description, execution_status } = {}) {
        return {
            id: id ?? uuidv4(),
            proccess_description: proccess_description ?? BackgroundProcessEnum.ACTION_QUEUE_EXECUTION.value,
            execution_status: execution_status ?? 0,
        };
    }

    /**
     * Creates a `BackgroundExecution` instance and saves it to the repository.
     *
     * @param {KnexBackgroundExecutionRepository} repository - The repository to save the `BackgroundExecution` instance.
     * @returns {Promise<BackgroundExecution>} The created `BackgroundExecution` instance.
     */
    static async create(repository, data = {}) {
        const backgroundExecution = BackgroundExecution.create(BackgroundExecutionMother.dto(data));
        await repository.save(backgroundExecution);
        return backgroundExecution;
    }
}

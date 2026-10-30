import { ValueObjectProccessDescription } from '../../../../background-executions/domain/value-objects/ValueObjectProccessDescription';
import { KnexBackgroundExecutionRepository } from '../../../../background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository';
import { CustomError } from '../../../errors/CustomError';

export class BackgroundExecutionService {
    /**
     * @type {KnexBackgroundExecutionRepository}
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async findBackgroundExecution(backgroundProcess) {
        return await this.#repository.findByProcess(new ValueObjectProccessDescription(backgroundProcess));
    }

    async updateBackgroundExecution(backgroundProcess, dto) {
        const backgroundExecution = await this.findBackgroundExecution(backgroundProcess);

        if (!backgroundExecution) {
            throw new CustomError(`backgroundExecution ${backgroundProcess} does not exist.`, 404);
        }

        backgroundExecution.update({
            ...dto,
            updated_at: new Date().toISOString(),
        });

        await this.#repository.update(backgroundExecution);

        backgroundExecution.flushChanges();
    }
}

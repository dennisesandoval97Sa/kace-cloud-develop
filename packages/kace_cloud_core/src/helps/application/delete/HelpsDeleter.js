import { ValueObjectUuid } from '../../../shared';
import { CustomError } from '../../../shared/errors/CustomError';

export class HelpsDeleter {
    /** @type {KnexHelpsRepository} is initialized in the constructor */
    #repository;
    constructor(repository) {
        this.#repository = repository;
    }

    async execute(id, dto) {
        const help = await this.#repository.find(new ValueObjectUuid('id', id));

        if (help.deleted_by.value) {
            throw new CustomError(`Help with id ${id} does not exist.`, 404);
        }

        const originalValues = help.toJson();
        help.delete(dto);

        await this.#repository.delete(help);
        await this.#repository.saveHistory(help, originalValues);
        help.flushChanges();
    }
}

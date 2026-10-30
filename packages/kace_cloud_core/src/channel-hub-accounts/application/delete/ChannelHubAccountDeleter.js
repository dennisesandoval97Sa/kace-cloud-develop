import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccountFinder as DomainFinder } from '../../domain/ChannelHubAccountFinder.js';

export class ChannelHubAccountDeleter {
    #finder;
    #repository;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainFinder(repository);
    }

    async execute(id, dto) {
        const account = await this.#finder.execute(id);

        if (!account) {
            throw new CustomError('The Channel Hub account you are trying to delete does not exist', 404);
        }

        account.delete(dto);
        await this.#repository.delete(account);
    }
}
